import csv
import io
import json
import zcatalyst_sdk

def handler(request):
    try:
        # Initialize Catalyst app
        app = zcatalyst_sdk.initialize()
        datastore = app.datastore()

        # Get table_name from query parameters (using Flask request syntax)
        table_name = request.args.get("table_name")
        if not table_name:
            return json.dumps({"status": "error", "message": "Missing 'table_name' query parameter"}), 400

        # Get raw body text/bytes from incoming HTTP POST request
        raw_body = request.get_data(as_text=True)

        if not raw_body:
            return json.dumps({
                "status": "error",
                "message": "No CSV content provided in request body"
            }), 400

        # Read and parse CSV directly in memory
        csv_file = io.StringIO(raw_body)
        reader = csv.DictReader(csv_file)
        parsed_rows = [row for row in reader]

        if len(parsed_rows) == 0:
            return json.dumps({"status": "error", "message": "CSV is empty"}), 400

        # Insert rows into Catalyst Datastore in batches of 100
        table = datastore.table(table_name)
        batch_size = 100
        inserted_count = 0

        for i in range(0, len(parsed_rows), batch_size):
            batch = parsed_rows[i:i + batch_size]
            table.insert_rows(batch)
            inserted_count += len(batch)

        # Return response
        return json.dumps({
            "status": "success",
            "message": f"Successfully inserted {inserted_count} rows into '{table_name}'",
            "total_rows": inserted_count,
            "sample_rows": parsed_rows[:2]  # Returns first 2 parsed records
        }), 200

    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": str(e)
        }), 500
