import os

# Note: The PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION env var was previously required
# for zemberek-grpc compatibility. It is no longer needed since Zemberek is not
# imported by the main application in this MedGemma-only architecture.

from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback
import json

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Load MedGemma module once at startup (not lazy)
print("🚀 Loading MedGemma module at startup...")
import medgemma as rag
print("✅ MedGemma module loaded successfully!")

@app.route('/health', methods=['GET'])
def health():
  return jsonify({'status': 'ok'})


@app.route('/api/ask', methods=['POST'])
def api_ask():
  print("api_ask called")
  """JSON API: accepts {'symptoms': '...'} and returns MedGemma analysis as JSON."""
  data = request.get_json(force=True, silent=True) or {}
  symptoms = (data.get('symptoms') or '').strip()
  if not symptoms:
    return jsonify({'error': 'symptoms required'}), 400

  try:
    answer_text, normalized_symptoms = rag.ask_medgemma(symptoms)
    print("=" * 20)
    print(f"Answer: {answer_text}")
    print(f"Normalized symptoms: {normalized_symptoms}")

    # Try to parse the answer (MedGemma returns a JSON string).
    parsed = None
    if isinstance(answer_text, str):
      try:
        parsed = json.loads(answer_text)
      except Exception:
        parsed = None

    # Determine confidence from disease_probabilities to decide if survey is needed
    should_skip_questions = False
    if parsed and isinstance(parsed, dict):
      probs = parsed.get('disease_probabilities', [])
      if probs and len(probs) > 0:
        top_prob = probs[0].get('probability', 0)
        other_probs = [p.get('probability', 0) for p in probs[1:]]
        if top_prob > 0.7 and all(p < 0.7 for p in other_probs):
          should_skip_questions = True
          print(f"🎯 High confidence: top={top_prob:.2f}, skipping questions")
        else:
          print(f"❓ Low confidence: top={top_prob:.2f}, will ask questions")

      parsed['should_skip_questions'] = should_skip_questions
      if should_skip_questions:
        parsed['symptoms_to_ask'] = []

    return jsonify({
      'answer': parsed if parsed is not None else answer_text,
      'normalized_symptoms': normalized_symptoms,
      'should_skip_questions': should_skip_questions
    })
  except Exception as e:
    print(f"Error in MedGemma processing: {e}")
    traceback.print_exc()
    return jsonify({'error': 'MedGemma processing failed', 'detail': str(e), 'traceback': traceback.format_exc()}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)

