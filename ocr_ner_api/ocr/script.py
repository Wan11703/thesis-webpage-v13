import ast
import sys
import json

if __name__ == "__main__":
    try:
        # Parse input from sys.argv
        input_data = ast.literal_eval(sys.argv[1])

        # Process the input data (example: append additional data)
        extracted_drug_names = input_data.get("extracted_drug_names", [])
        processed_data = {
            "extracted_drug_names": extracted_drug_names,
            "additional_info": "Processed successfully"
        }

        # Output the result as JSON
        print(json.dumps(processed_data))
        sys.stdout.flush()
    except Exception as e:
        # Handle errors and output as JSON
        print(json.dumps({"error": str(e)}))
        sys.stdout.flush()
        sys.exit(1)