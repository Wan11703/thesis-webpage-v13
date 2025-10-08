import pandas as pd
from flask import Flask, request, jsonify
from transformers import BertForTokenClassification, BertTokenizer
import torch

app = Flask(__name__)

custom_model_path = "castoBin/BiobertNer"
custom_model = BertForTokenClassification.from_pretrained(custom_model_path)
custom_tokenizer = BertTokenizer.from_pretrained(custom_model_path)

pretrained_model_path = "alvaroalon2/biobert_chemical_ner"
pretrained_model = BertForTokenClassification.from_pretrained(pretrained_model_path)
pretrained_tokenizer = BertTokenizer.from_pretrained(pretrained_model_path)

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

    # ✅ DEBUG PRINT
    print("\n--- Token Debug ---")
    for t, l, c in zip(tokens, labels, confidences):
        if t not in ["[CLS]", "[SEP]", "[PAD]"]:
            print(f"{t:15s} | {l:8s} | conf={c:.3f}")
    print("-------------------\n")

    drugs = []
    current_drug, current_conf = [], []

    def finalize_entity():
        if current_drug and min(current_conf) > threshold:
            # Merge subwords
            word = ""
            for t in current_drug:
                if t.startswith("##"):
                    word += t[2:]
                else:
                    word += (" " + t if word else t)
            drugs.append(word.strip())

    prev_label = "O"
    for token, label, conf in zip(tokens, labels, confidences):
        if token in ["[CLS]", "[SEP]", "[PAD]"]:
            continue

        # Treat B- followed by B- as continuation (fixes your case)
        if label.startswith("B-") or label.startswith("I-"):
            if prev_label == "O":
                finalize_entity()
                current_drug = [token]
                current_conf = [conf]
            else:
                current_drug.append(token)
                current_conf.append(conf)
        else:
            finalize_entity()
            current_drug, current_conf = [], []

        prev_label = label

    finalize_entity()
    return drugs



def extract_drug_names(text):
    custom_drugs = run_ner(custom_model, custom_tokenizer, text)
    pretrained_drugs = run_ner(pretrained_model, pretrained_tokenizer, text)
    merged_drugs = custom_drugs + pretrained_drugs

    cleaned_drugs = []
    for drug in merged_drugs:
        cleaned = " ".join([w for w in drug.split() if w.lower() not in irrelevant_words])
        if cleaned:
            cleaned_drugs.append(cleaned.strip())

    normalized = [(d.replace(" ", "").lower(), d) for d in cleaned_drugs]
    keep = []

    for i, (nd, orig) in enumerate(normalized):
        if len(nd) < 4 and any(nd in other for j, (other, _) in enumerate(normalized) if i != j):
            continue
        if any(len(nd) < len(other) and nd in other for j, (other, _) in enumerate(normalized) if i != j):
            continue
        keep.append(orig)

    unique_drugs = []
    seen = set()
    for drug in keep:
        d_lower = drug.lower()
        if d_lower not in seen:
            seen.add(d_lower)
            unique_drugs.append(drug)

    return unique_drugs


# Example test
corrected_text = "/rosuvastatin/ [tablet 10 mg] (1 a day) <no duration> was prescribed./aspirin/ [tablet 80 mg] (1 a day) <no duration> was prescribed./citicholine/ [tablet 1 gm] (2 a day) <no duration> was prescribed./baclofen/ [tablet 10 mg] (1 a day) <no duration> was prescribed."
extracted_drugs = extract_drug_names(corrected_text)
print("Extracted Drugs:", extracted_drugs)










