import csv
import io
import json
import zcatalyst_sdk

def handler(request, response):
    try:
        # Initialize Catalyst app
        app = zcatalyst_sdk.initialize()
        datastore = app.datastore()

        # Get table_name from query parameters
        table_name = request.get_query("table_name")
        if not table_name:
            response.set_status(400)
            return json.dumps({"status": "error", "message": "Missing 'table_name' query parameter"})

        # Get raw body text/bytes from the incoming request
        raw_body = request.get_data(as_text=True)

        if not raw_body:
            response.set_status(400)
            return json.dumps({"status": "error", "message": "No CSV content sent"})

        # Read CSV directly in memory
        csv_file = io.StringIO(raw_body)
        reader = csv.DictReader(csv_file)
        
        parsed_data = [row for row in reader]

        if len(parsed_data) == 0:
            response.set_status(400)
            return json.dumps({"status": "error", "message": "CSV is empty"})

        # Insert rows into Catalyst Datastore in batches of 100
        table = datastore.table(table_name)
        batch_size = 100
        inserted_count = 0

        for i in range(0, len(parsed_data), batch_size):
            batch = parsed_data[i:i + batch_size]
            table.insert_rows(batch)
            inserted_count += len(batch)

        # Return response
        response.set_status(200)
        return json.dumps({
            "status": "success",
            "message": f"Successfully inserted {inserted_count} rows into '{table_name}'",
            "total_rows": inserted_count,
            "sample_data": parsed_data[:2]  # Returns first 2 rows as sample
        })

    except Exception as e:
        response.set_status(500)
        return json.dumps({"status": "error", "message": str(e)})
