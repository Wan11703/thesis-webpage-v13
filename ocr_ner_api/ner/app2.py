import pandas as pd
from flask import Flask, request, jsonify
from transformers import BertForTokenClassification, BertTokenizer
import torch

# Initialize Flask app
app = Flask(__name__)

# Load your fine-tuned custom model
custom_model_path = "castoBin/BiobertNer"
custom_model = BertForTokenClassification.from_pretrained(custom_model_path)
custom_tokenizer = BertTokenizer.from_pretrained(custom_model_path)

# Load the pretrained BioBERT model for secondary matching
pretrained_model_path = "alvaroalon2/biobert_chemical_ner"
pretrained_model = BertForTokenClassification.from_pretrained(pretrained_model_path)
pretrained_tokenizer = BertTokenizer.from_pretrained(pretrained_model_path)

# Define irrelevant words
irrelevant_words = {
    "week", "hours", "emergency", "cream", "ointment", "suspension",
    "tablet", "capsule", "injection", "solution", "and", "m.v.i. adult",
    "age", "ad", "day"
}

def run_ner(model, tokenizer, text, threshold=0.2):
    if len(text.split()) > 1024:
        raise ValueError("Input text is too long. Please split it.")

    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)

    logits = outputs.logits
    predictions = torch.argmax(logits, dim=2)
    scores = torch.softmax(logits, dim=2)

    tokens = tokenizer.convert_ids_to_tokens(inputs["input_ids"][0])
    labels = [model.config.id2label[p.item()] for p in predictions[0]]
    confidences = [scores[0, i, p.item()].item() for i, p in enumerate(predictions[0])]

    drugs = []
    current_drug, current_conf = [], []

    def finalize_entity():
        if current_drug and min(current_conf) > threshold:
            word = ""
            for t in current_drug:
                if t.startswith("##"):
                    word += t[2:]
                elif word == "":
                    word = t
                else:
                    word += " " + t
            drugs.append(word)

    for token, label, conf in zip(tokens, labels, confidences):
        if label.startswith("B-"):
            finalize_entity()
            current_drug = [token]
            current_conf = [conf]
        elif label.startswith("I-") and current_drug:
            current_drug.append(token)
            current_conf.append(conf)
        else:
            finalize_entity()
            current_drug, current_conf = [], []

    finalize_entity()
    return drugs






def extract_drug_names(text):
    # Step 1: Extract with both models
    custom_drugs = run_ner(custom_model, custom_tokenizer, text)
    pretrained_drugs = run_ner(pretrained_model, pretrained_tokenizer, text)

    # Step 2: Merge results
    merged_drugs = custom_drugs + pretrained_drugs

    # Step 3: Clean irrelevant words
    cleaned_drugs = []
    for drug in merged_drugs:
        cleaned = " ".join([w for w in drug.split() if w.lower() not in irrelevant_words])
        if cleaned:
            cleaned_drugs.append(cleaned.strip())

    # Step 4: Remove fragments & duplicates
    normalized = [(d.replace(" ", "").lower(), d) for d in cleaned_drugs]
    keep = []

    for i, (nd, orig) in enumerate(normalized):
        # Drop very short fragments if longer exists
        if len(nd) < 4 and any(nd in other for j, (other, _) in enumerate(normalized) if i != j):
            continue
        # Drop substrings of longer drugs
        if any(len(nd) < len(other) and nd in other for j, (other, _) in enumerate(normalized) if i != j):
            continue
        keep.append(orig)

    # Deduplicate preserving order
    unique_drugs = []
    seen = set()
    for drug in keep:
        d_lower = drug.lower()
        if d_lower not in seen:
            seen.add(d_lower)
            unique_drugs.append(drug)

    return unique_drugs



# Example test
corrected_text = "Losartan was prescribed. Ferrous sulfate was prescribed. Citicoline was prescribed. Baclofen was prescribed."
extracted_drugs = extract_drug_names(corrected_text)
print("Extracted Drugs:", extracted_drugs)









