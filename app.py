from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from langchain_groq import ChatGroq
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain.docstore.document import Document
from dotenv import load_dotenv
import os
import json
import csv
from io import StringIO

load_dotenv()
app = Flask(__name__, 
    template_folder='templates',
    static_folder='static'
)
CORS(app)

# Initialize clients
groq_api_key = os.getenv("GROQ_API_KEY")
google_api_key = os.getenv("GOOGLE_API_KEY")

llm = ChatGroq(
    groq_api_key=groq_api_key,
    model_name="llama-3.3-70b-versatile"
)

embeddings = GoogleGenerativeAIEmbeddings(
    model="models/embedding-001",
    google_api_key=google_api_key
)

def process_csv_to_chunks(csv_data):
    # Read CSV directly using csv module
    csv_file = StringIO(csv_data)
    csv_reader = csv.reader(csv_file)
    
    # Get headers and first few rows
    headers = next(csv_reader)
    sample_rows = []
    row_count = 0
    column_data = {header: [] for header in headers}
    
    # Process the first 5 rows for sample and collect column data
    for row in csv_reader:
        row_count += 1
        if len(sample_rows) < 5:
            sample_rows.append(dict(zip(headers, row)))
        # Collect data for each column
        for header, value in zip(headers, row):
            column_data[header].append(value)
    
    # Analyze data types and missing values
    data_info = {
        'total_rows': row_count,
        'columns': headers,
        'sample_data': sample_rows,
        'missing_values': {
            header: sum(1 for val in values if not val.strip())
            for header, values in column_data.items()
        }
    }
    
    # Convert to text for chunking
    dataset_text = json.dumps(data_info, indent=2)
    
    # Create text splitter
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        separators=["\n\n", "\n", " ", ""]
    )
    
    # Split text into chunks and create documents
    texts = text_splitter.split_text(dataset_text)
    documents = [
        Document(
            page_content=chunk,
            metadata={"source": f"chunk_{i}", "type": "dataset_info"}
        )
        for i, chunk in enumerate(texts)
    ]
    
    return documents, data_info

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze_dataset', methods=['POST'])
def analyze_dataset():
    try:
        data = request.get_json()
        dataset = data.get('dataset')
        
        if not dataset:
            return jsonify({"success": False, "error": "No dataset provided"}), 400
        
        # Convert dataset array to CSV string
        csv_data = '\n'.join([','.join(str(cell) for cell in row) for row in dataset])
        
        # Process CSV into document chunks
        documents, data_info = process_csv_to_chunks(csv_data)
        
        # Create Chroma vector store from documents
        db = Chroma.from_documents(
            documents=documents,
            embedding=embeddings,
            persist_directory="./chroma_db"
        )
        
        # Query the vector store
        similar_chunks = db.similarity_search(
            "What kind of ML pipeline would be suitable for this dataset?",
            k=3
        )
        
        # Update the prompt to explicitly request JSON format
        prompt = f"""
        Based on this dataset information:
        {similar_chunks[0].page_content}
        
        Return a JSON array of pipeline steps. Each step must have these exact fields:
        - "type": one of [data, explore, feature, preprocess, model, tune, validate, evaluate, deploy]
        - "operation": specific operation from the available options below
        - "explanation": why this step is needed

        Available operations for each type:
        - data:
            - "input" (CSV file input)
        - explore:
            - "summary" (Summary Statistics)
            - "missing" (Check Missing Values)
            - "visualize" (Visualize Data)
        - feature:
            - "encoding" (Categorical Encoding)
            - "scaling" (Feature Scaling)
            - "selection" (Feature Selection)
        - preprocess:
            - "split" (Train-Test Split)
            - "impute" (Impute Missing Values)
            - "normalize" (Normalize Data)
        - model:
            - "logistic_regression" (Logistic Regression)
            - "random_forest" (Random Forest)
            - "svm" (Support Vector Machine)
            - "xgboost" (XGBoost)
        - tune:
            - "grid" (Grid Search)
            - "random" (Random Search)
            - "bayesian" (Bayesian Optimization)
        - validate:
            - "cross_val" (Cross-Validation)
            - "holdout" (Holdout Validation)
        - evaluate:
            - "classification" (Classification Metrics)
            - "regression" (Regression Metrics)
            - "clustering" (Clustering Metrics)
        - deploy:
            - "pickle" (Save as Pickle)
            - "onnx" (Export as ONNX)
        
        Format the response as valid JSON only, with no additional text.
        Example format:
        [
            {{"type": "data", "operation": "input", "explanation": "Load the dataset"}},
            {{"type": "explore", "operation": "summary", "explanation": "Analyze basic statistics"}}
        ]
        """
        
        response = llm.invoke(prompt)
        response_content = response.content.strip()
        
        # Format the pipeline response
        try:
            pipeline_steps = json.loads(response_content)
            if not isinstance(pipeline_steps, list):
                raise ValueError("Response is not a JSON array")
            
            # Format each step nicely
            formatted_pipeline = []
            for step in pipeline_steps:
                formatted_step = {
                    "type": step.get("type", ""),
                    "operation": step.get("operation", ""),
                    "explanation": step.get("explanation", "")
                }
                formatted_pipeline.append(formatted_step)
            
            # Create a formatted string for display
            formatted_output = json.dumps(
                formatted_pipeline, 
                indent=2,
                ensure_ascii=False
            )
            
            return jsonify({
                "success": True,
                "pipeline": formatted_output,
                "data_info": data_info
            })
            
        except json.JSONDecodeError:
            # If not valid JSON, try to extract and format JSON from the response
            import re
            json_match = re.search(r'\[.*\]', response_content, re.DOTALL)
            if json_match:
                pipeline_steps = json.loads(json_match.group(0))
                formatted_output = json.dumps(
                    pipeline_steps,
                    indent=2,
                    ensure_ascii=False
                )
                return jsonify({
                    "success": True,
                    "pipeline": formatted_output,
                    "data_info": data_info
                })
            else:
                raise ValueError("Could not extract valid JSON from response")
        
    except Exception as e:
        print(f"Error: {str(e)}")  # Debug print
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
