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
    """Run NER on text with a given model and tokenizer"""
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

    # Reconstruct entities
    word_labels = []
    current_word, current_label, current_conf = "", "O", 0.0
    drugs = []

    for token, label, conf in zip(tokens, labels, confidences):
        if token.startswith("##"):
            current_word += token[2:]
            current_conf = min(current_conf, conf)
        else:
            if current_word and (current_label.startswith("B-") or current_label.startswith("I-")):
                if current_conf > threshold:
                    drugs.append(current_word)
            current_word = token
            current_label = label
            current_conf = conf

    if current_word and (current_label.startswith("B-") or current_label.startswith("I-")):
        if current_conf > threshold:
            drugs.append(current_word)

    return drugs

def extract_drug_names(text):
    # Step 1: Extract with custom fine-tuned model
    custom_drugs = run_ner(custom_model, custom_tokenizer, text)

    # Step 2: Extract with pretrained BioBERT for extra matching
    pretrained_drugs = run_ner(pretrained_model, pretrained_tokenizer, text)

    # Step 3: Merge results
    merged_drugs = custom_drugs + pretrained_drugs

    # ✅ Improved cleaning & filtering
    text_lower = text.lower()
    cleaned_drugs = []
    for drug in merged_drugs:
        # remove irrelevant words
        cleaned = " ".join([w for w in drug.split() if w.lower() not in irrelevant_words])
        cleaned = cleaned.strip()
        if cleaned:  # only keep non-empty
            cleaned_drugs.append(cleaned)

    # ✅ Deduplicate while preserving order
    unique_drugs = []
    seen = set()
    for drug in cleaned_drugs:
        d_lower = drug.lower()
        if d_lower not in seen:
            seen.add(d_lower)
            unique_drugs.append(drug)

    return unique_drugs





# Example test
corrected_text = "Losartan was prescribed. Aspirin was prescribed. Citicoline was prescribed. Baclofen was prescribed."
extracted_drugs = extract_drug_names(corrected_text)
print("Extracted Drugs:", extracted_drugs)









