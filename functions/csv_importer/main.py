import csv
import io
import json

def handler(request, response):
    try:
        # Get raw body text/bytes from the incoming request
        raw_body = request.get_data(as_text=True)

        if not raw_body:
            response.set_status(400)
            return json.dumps({"status": "error", "message": "No CSV content sent"})

        # Read CSV directly in memory
        csv_file = io.StringIO(raw_body)
        reader = csv.DictReader(csv_file)
        
        parsed_data = [row for row in reader]

        # Process your rows here (e.g., call external APIs, perform calculations)
        # TODO: You can use zcatalyst_sdk to insert into Datastore here if needed!

        # Return response
        response.set_status(200)
        return json.dumps({
            "status": "success",
            "total_rows": len(parsed_data),
            "sample_data": parsed_data[:5]  # Returns first 5 rows
        })

    except Exception as e:
        response.set_status(500)
        return json.dumps({"status": "error", "message": str(e)})
