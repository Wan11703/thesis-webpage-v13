from flask import Flask, request, jsonify
from flask_cors import CORS  # Import Flask-CORS
import pandas as pd
import openai
import re
from config import OPENAI_API_KEY

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])   # Enable CORS for the entire app

# Define the path to the CSV files
df_path = r'C:\Users\Mark Vincent\Desktop\thesis-webpage\drug_api\drugbank_clean.csv'
df_prepared_path = r'C:\Users\Mark Vincent\Desktop\thesis-webpage\drug_api\drug_information.csv'

# Set up your OpenAI API key
client = openai.OpenAI(api_key=OPENAI_API_KEY)

def get_drug_info(drug_name):
    try:
        # Load DataFrames
        df_prepared = pd.read_csv(df_prepared_path, index_col="name")
        df = pd.read_csv(df_path, low_memory=False)  # Suppress DtypeWarning
        drug_name_lower = drug_name.lower()

        # Check if the drug exists in the database
        try:
            drug_info = df_prepared.loc[df_prepared.index.str.lower() == drug_name_lower].iloc[0]
        except IndexError:
            print(f"Drug '{drug_name}' not found in the database.")
            return None

        # Process drug interactions
        # Process drug interactions
        if isinstance(drug_info['drug-interactions'], str):
            interactions = drug_info['drug-interactions'].split()
            mapped_interactions = []
            for interaction_id in interactions:
                try:
                    drug_name_for_id = df[df['drugbank-id'].str.lower() == interaction_id.lower()]['name'].iloc[0]
                    mapped_interactions.append(drug_name_for_id)
                except IndexError:
                    pass

            # Keep only the first 10 unique drugs
            mapped_interactions = list(dict.fromkeys(mapped_interactions))[:10]

            drug_info['drug-interactions'] = ', '.join(mapped_interactions)


        # Extract drug information
        drug_information = drug_info['description']
        indication = drug_info['indication']
        side_effects = drug_info['toxicity']
        interaction = f"Food Interactions: {drug_info['food-interactions']}\nDrug Interactions: {drug_info['drug-interactions']}"

        return drug_information, indication, side_effects, interaction

    except (KeyError, IndexError) as e:
        print(f"Error processing drug information: {e}")
        return None

def get_medicine_price(medicine_name, strength=None, frequency=None, duration=None):
    form = infer_form_from_strength(strength)
    try:
        client = openai.OpenAI(api_key=openai.api_key)
        user_prompt = (
            f"Medicine: {medicine_name}\n"
            f"Strength: {strength or 'N/A'}\n"
            f"Frequency: {frequency or 'N/A'}\n"
            f"Duration: {duration or 'N/A'}\n"
            f"Form: {form}\n\n"
            "Tasks:\n"
            "1. Identify one well-known branded product and one generic product for this medicine in the Philippines.\n"
            "2. Give the most recent, updated and typical retail price per package (bottle/tube/box/piece) for each, using the brand name and the generic name.\n"
            "3. If the drug is a liquid (ml) or ointment/cream (grams), assume standard package sizes (e.g., 60ml bottle, 5g tube, 10 tablets per blister pack).\n"
            "4. Format your answer as:\n"
            "Branded: <BrandName> - ₱<price> per {form}\n"
            "Generic: <GenericName> - ₱<price> per {form}\n"
            "If price is not available, write 'N/A'."
        )
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": (
                    "You are an assistant that provides medicine prices for the Philippines."
                )},
                {"role": "user", "content": user_prompt}
            ]
        )
        print("OpenAI price response:\n", response.choices[0].message.content)
        return response.choices[0].message.content
    except Exception as e:
        return f"Error: {str(e)}"

def get_dosage_guidelines(medicine_name, raw_text):
    try:
        client = openai.OpenAI(api_key=openai.api_key)
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": (
                    "You are a medical assistant that restructures unstructured dosage guidelines into a structured format "
                    "based strictly on the given raw text and medicine name.\n\n"
                    "Do not add extra commentary or explanation."
                )},
                {"role": "user", "content": (
                    f"Medicine: {medicine_name}\n"
                    f"Raw text: {raw_text}"
                )}
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error: {str(e)}"

def summarize_drug_info(drug_information, interaction, side_effects, dosage, strength=None, frequency=None, price=None, duration=None):
    try:
        client = openai.OpenAI(api_key=openai.api_key)
        custom_dosage = dosage
        custom_price = price

        # If strength and frequency are provided, customize the dosage and price
        if strength and frequency:
            custom_dosage = (
                f"Take {strength} per dose, {frequency} per day"
                + (f" for {duration}" if duration and duration.lower() != "no duration" else "")
                + " as prescribed by your doctor. Always follow your healthcare provider's instructions for timing and duration."
            )
            price_lines = []
            if 'Branded' in brand_generic_prices:
                branded = brand_generic_prices['Branded']
                price_lines.append(
                    f"Branded: {branded['name']} - ₱{branded['price']} per {form}" if branded['price'] != 'N/A'
                    else f"Branded: {branded['name']} - N/A"
                )
            if 'Generic' in brand_generic_prices:
                generic = brand_generic_prices['Generic']
                price_lines.append(
                    f"Generic: {generic['name']} - ₱{generic['price']} per {form}" if generic['price'] != 'N/A'
                    else f"Generic: {generic['name']} - N/A"
                )
            custom_price = "\n".join([f"• {line}" for line in price_lines]) if price_lines else "No fixed price available for this drug."
        else:
            custom_dosage = summarized_dosage
            custom_price = price_text

        prompt = (
            "Summarize the following medication information for a patient in 1-2 very short sentences. "
            "Do NOT copy any sentences or phrases from the input. Use simple, layman's terms. "
            "If the information is too long, only mention the most important points. "
            "Focus on what the medicine is for, important interactions, common side effects, and basic dosage guidelines. "
            "If dosage, frequency, and duration are provided, use them to describe how the medicine should be taken. "
            "If price is provided, mention the estimated daily or total price.\n\n"
            f"Medication Detail: {drug_information}\n"
            f"Drug Interaction: {interaction}\n"
            f"Side Effects: {side_effects}\n"
            f"Dosage Guidelines: {custom_dosage}\n"
            f"Price: {custom_price}\n"
        )
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a medical assistant that summarizes drug information for patients."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=120,
            temperature=0.3
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Error: {str(e)}"

def summarize_field(field_text, field_type):
    try:
        client = openai.OpenAI(api_key=openai.api_key)
        if field_type == "description":
            prompt = (
                "Summarize the following drug description for a patient in 1-5 short sentences. "
                "Use simple language. Do not copy the input text.\n\n"
                f"{field_text}"
            )
        elif field_type == "interaction":
            prompt = (
                "Summarize the following drug interaction information for a patient in 4 short sentence. "
                "List the following drug interactions for a patient in simple words. "
                "Show at most 10 drug names. If more exist, just say 'and others'. "
                "Keep it short and clear.\n\n"
                f"{field_text}"
            )

        elif field_type == "side_effects":
            prompt = (
                "Summarize the following side effects for a patient in 1-5 short sentences. "
                "Only mention the most common or serious side effects. Use simple language.\n\n"
                f"{field_text}"
            )
        elif field_type == "dosage":
            prompt = (
                "Summarize the following dosage guidelines for a patient in 1-5 short sentences. "
                "Use simple language.\n\n"
                f"{field_text}"
            )
        else:
            prompt = field_text

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a medical assistant that summarizes drug information for patients."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=60,
            temperature=0.2
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Error: {str(e)}"

def clean_text(text):
    # Remove [references]
    text = re.sub(r'\[[^\]]*\]', '', text)
    # Remove (parentheticals) except for the first one after the drug name
    text = re.sub(r'\((?!paracetamol\)).*?\)', '', text, flags=re.IGNORECASE)
    # Remove underscores
    text = text.replace('_', '')
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def parse_pharmacy_prices(price_text):
    pharmacies = ["Watsons", "Mercury Drug", "South Star Drug", "The Generics Pharmacy", "Generika", "Other"]
    prices = {}
    for line in price_text.splitlines():
        for pharmacy in pharmacies:
            if pharmacy.lower() in line.lower():
                match = re.search(r'₱\s*([\d\.]+)', line)
                if match:
                    prices[pharmacy] = float(match.group(1))
                else:
                    prices[pharmacy] = "N/A"
    return prices

def parse_brand_generic_prices(price_text):
    prices = {}
    for line in price_text.splitlines():
        # Match Branded
        branded_match = re.search(r'branded\**:?\s*(.+?)\s*-\s*₱\s*([\d,\.]+)', line, re.IGNORECASE)
        if branded_match:
            price_str = branded_match.group(2).replace(",", "")  # remove commas
            prices['Branded'] = {
                'name': branded_match.group(1).strip(),
                'price': float(price_str)
            }
            continue

        # Match Generic
        generic_match = re.search(r'generic\**:?\s*(.+?)\s*-\s*₱\s*([\d,\.]+)', line, re.IGNORECASE)
        if generic_match:
            price_str = generic_match.group(2).replace(",", "")  # remove commas
            prices['Generic'] = {
                'name': generic_match.group(1).strip(),
                'price': float(price_str)
            }
            continue

    return prices



def infer_form_from_strength(strength):
    strength = (strength or "").lower()
    if "mg" in strength:
        return "piece"
    if any(x in strength for x in ["bottle", "ml"]):
        return "bottle"
    if any(x in strength for x in ["ointment", "cream", "tube", "g"]):
        return "tube"
    if any(x in strength for x in ["tablet", "tab", "capsule", "cap", "piece", "pill"]):
        return "piece"
    return "piece"  # Default to piece if unsure

@app.route('/get-drug-info', methods=['POST'])
def get_drug_info_endpoint():
    data = request.get_json()
    drug_name = data.get('drug_name', [])
    strength = data.get('strength', '')
    frequency = data.get('frequency', '')
    duration = data.get('duration', '')

    result = get_drug_info(drug_name)
    
    if result:
        drug_information, indication, side_effects, interaction = result
        drug_information = clean_text(drug_information)
        side_effects = clean_text(side_effects)
        interaction = clean_text(interaction)

        summarized_drug_information = summarize_field(drug_information, "description")
        summarized_interaction = summarize_field(interaction, "interaction")
        summarized_side_effects = summarize_field(side_effects, "side_effects")
        dosage = get_dosage_guidelines(drug_name, data.get('raw_text', ''))
        summarized_dosage = summarize_field(dosage, "dosage")
        price_text = get_medicine_price(drug_name, strength, frequency, duration)
        brand_generic_prices = parse_brand_generic_prices(price_text)

        # Pass strength, frequency, and price to the summary
        summary = summarize_drug_info(
            summarized_drug_information,
            summarized_interaction,
            summarized_side_effects,
            summarized_dosage,
            strength=strength,
            frequency=frequency,
            price=price_text
        )

        return jsonify({
            "drug_information": summarized_drug_information,
            "indication": summarize_field(indication, "description"),
            "dosage": summarized_dosage if not (strength and frequency) else f"{strength} per dose, {frequency} per day",
            "side_effects": summarized_side_effects,
            "interaction": summarized_interaction,
            "price": price_text,
            "summary": summary,
            "strength": strength,
            "frequency": frequency,
            "duration": duration,  # <-- add this
        })
    else:
        return jsonify({"error": f"Drug '{drug_name}' not found in the database."}), 404


@app.route('/get-extract-info', methods=['POST'])
def get_extract_info_endpoint():
    data = request.get_json()
    drug_name = data.get('drug_name', [])
    strength = data.get('strength', '')
    frequency = data.get('frequency', '')
    duration = data.get('duration', '')

    form = infer_form_from_strength(strength)  # <-- ADD THIS LINE

    result = get_drug_info(drug_name)
    
    if result:
        drug_information, indication, side_effects, interaction = result
        drug_information = clean_text(drug_information)
        side_effects = clean_text(side_effects)
        interaction = clean_text(interaction)

        summarized_drug_information = summarize_field(drug_information, "description")
        summarized_interaction = summarize_field(interaction, "interaction")
        summarized_side_effects = summarize_field(side_effects, "side_effects")
        dosage = get_dosage_guidelines(drug_name, data.get('raw_text', ''))
        summarized_dosage = summarize_field(dosage, "dosage")
        price_text = get_medicine_price(drug_name, strength, frequency, duration)
        brand_generic_prices = parse_brand_generic_prices(price_text)
        pharmacy_prices = parse_pharmacy_prices(price_text)


        # Custom dosage and price for extract
        if strength and frequency:
            num_days = None
            if duration and duration.lower() != "no duration":
                custom_dosage = (
                    f"Take {strength} per dose, {frequency} per day for {duration} as prescribed by your doctor. "
                    "Always follow your healthcare provider's instructions for timing and duration."
                )
                # Extract number of days
                days_match = re.search(r'(\d+)\s*(day|days|d)', duration, re.IGNORECASE)
                weeks_match = re.search(r'(\d+)\s*(week|weeks|w)', duration, re.IGNORECASE)
                months_match = re.search(r'(\d+)\s*(month|months|m)', duration, re.IGNORECASE)
                num_days = None
                if days_match:
                    num_days = int(days_match.group(1))
                elif weeks_match:
                    num_days = int(weeks_match.group(1)) * 7
                elif months_match:
                    num_days = int(months_match.group(1)) * 30  # Approximate 1 month as 30 days

                freq_num = int(re.findall(r'\d+', frequency)[0])
                price_lines = []
                for brand_type, info in brand_generic_prices.items():
                    price_per_unit = info['price']
                    name = info['name']

                    if form == "piece" and isinstance(price_per_unit, float) and num_days:
                        total_price = price_per_unit * freq_num * num_days
                        price_lines.append(
                            f"{brand_type}: {name} - ₱{price_per_unit:.2f} per {form}, "
                            f"total for {duration}: ₱{total_price:.2f}"
                        )
                    elif form == "piece" and isinstance(price_per_unit, float):
                        daily_price = price_per_unit * freq_num
                        price_lines.append(
                            f"{brand_type}: {name} - ₱{price_per_unit:.2f} per {form}, daily: ₱{daily_price:.2f}"
                        )
                    elif isinstance(price_per_unit, float):
                        price_lines.append(f"{brand_type}: {name} - ₱{price_per_unit:.2f} per {form}")
                    else:
                        price_lines.append(f"{brand_type}: {name} - N/A")

                custom_price = "\n".join([f"• {line}" for line in price_lines]) if price_lines else "No fixed price available for this drug."
            else:
                custom_dosage = (
                    f"Take {strength} per dose, {frequency} per day as prescribed by your doctor. "
                    "Always follow your healthcare provider's instructions for timing and duration."
                )
                freq_num = int(re.findall(r'\d+', frequency)[0]) if frequency else 1  # <-- ADD THIS LINE
                price_lines = []
                for brand_type, info in brand_generic_prices.items():
                    price_per_unit = info['price']
                    name = info['name']

                    if isinstance(price_per_unit, float):
                        if form == "piece":  # only compute daily/total for tablets/capsules
                            if duration and num_days:
                                total_price = price_per_unit * freq_num * num_days
                                price_lines.append(
                                    f"{brand_type}: {name} - ₱{price_per_unit:.2f} per {form}, total for {duration}: ₱{total_price:.2f}"
                                )
                            else:
                                daily_price = price_per_unit * freq_num
                                price_lines.append(
                                    f"{brand_type}: {name} - ₱{price_per_unit:.2f} per {form}, daily: ₱{daily_price:.2f}"
                                )
                        else:
                            # for bottle, tube, ointment, cream, etc → show only general price
                            price_lines.append(f"{brand_type}: {name} - ₱{price_per_unit:.2f} per {form}")
                    else:
                        price_lines.append(f"{brand_type}: {name} - N/A")

                custom_price = "\n".join([f"• {line}" for line in price_lines]) if price_lines else "No fixed price available for this drug."


        else:
            custom_dosage = summarized_dosage
            custom_price = price_text

        summary = summarize_drug_info(
            summarized_drug_information,
            summarized_interaction,
            summarized_side_effects,
            custom_dosage,
            strength=strength,
            frequency=frequency,
            price=custom_price
        )

        return jsonify({
            "drug_information": summarized_drug_information,
            "indication": summarize_field(indication, "description"),
            "dosage": custom_dosage,
            "side_effects": summarized_side_effects,
            "interaction": summarized_interaction,
            "price": custom_price,
            "summary": summary,
            "strength": strength,
            "frequency": frequency,
            "duration": duration,
        })
    else:
        return jsonify({"error": f"Drug '{drug_name}' not found in the database."}), 404


@app.route('/process-raw-text', methods=['POST'])
def process_raw_text():
    try:
        data = request.get_json()
        raw_text = data.get('raw_text', '')

        if not raw_text:
            return jsonify({"success": False, "error": "No raw text provided"}), 400

        # Process the raw text (e.g., extract drug information)
        print(f"Received raw text: {raw_text}")
        # Add your drug information retrieval logic here

        # Example response
        return jsonify({"success": True, "message": "Raw text processed successfully"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500



if __name__ == '__main__':
    app.run(debug=True)