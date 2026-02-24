import json
import re
from huggingface_hub import InferenceClient
from config_loader import config

# ===========================
# 1. Setup & Initialization
# ===========================
print("⚙️ System initializing...")

# Initialize HuggingFace InferenceClient for MedGemma
client = InferenceClient(
    model=config.llm_model_name,
    token=config.get_hf_token(),
)


# ===========================
# 2. Core Helper
# ===========================
def _call_medgemma(messages, max_tokens=1024, temperature=0.1):
    """
    Call MedGemma via HuggingFace InferenceClient.
    Returns the response content string.
    Raises RuntimeError on API failure.
    """
    try:
        response = client.chat_completion(
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        raise RuntimeError(f"MedGemma inference failed: {e}") from e


# ===========================
# 3. Core MedGemma Logic
# ===========================
def ask_medgemma(user_input):
    """
    Analyzes user symptoms directly with MedGemma and returns structured JSON.
    Returns (answer_text, normalized_symptoms).
    """
    prompt = (
        "Sen bir tıbbi asistan yapay zeka sistemsin. "
        "Kullanıcının Türkçe olarak girdiği belirtileri analiz et ve tıbbi değerlendirme yap. "
        "Yanıtını **mutlaka JSON formatında ver** ve başka hiçbir metin ekleme. "
        "JSON yapısı şu şekilde olmalıdır (ÇİFT TIRNAK KULLAN): "
        '{ "patient_symptoms": [...], "departments": [...], "symptoms_to_ask": [...], '
        '"disease_probabilities": [{"disease": "...", "probability": 0.xx}], "explanation": "..." }'
        "\n\nKurallar: "
        "1. 'patient_symptoms' alanında, kullanıcının belirttiği belirtileri normalize edilmiş standart Türkçe adıyla listele. "
        "2. 'departments' alanında, belirtilere göre en uygun tıbbi bölümü veya bölümleri azalan güven sırasıyla listele (birincisi en uygun). "
        "   Türkiye hastanelerinde kullanılan bölüm adlarını kullan (örn: Nöroloji, Kardiyoloji, İç Hastalıkları, Ortopedi, vb.). "
        "3. 'symptoms_to_ask' alanında, daha iyi tanı için hastaya sorulabilecek ek belirtileri listele (maksimum 10). "
        "4. 'disease_probabilities' alanında, olası hastalıkları ve olasılıklarını (0.0-1.0 arası) azalan sırada listele (maksimum 5). "
        "5. 'explanation' alanında kısa ve detaylı klinik değerlendirme yap. "
        "6. MUTLAKA çift tırnak kullan, tek tırnak kullanma!\n\n"
        f"Kullanıcının belirtileri: {user_input}"
    )

    messages = [{"role": "user", "content": prompt}]

    result_text = _call_medgemma(messages, max_tokens=1024, temperature=config.temperature)
    print(f"🤖 MedGemma Response: {result_text}")

    # Extract JSON block from response (model may include surrounding text)
    json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
    if json_match:
        result_text = json_match.group(0)

    normalized_symptoms = []
    try:
        parsed = json.loads(result_text)
        normalized_symptoms = parsed.get('patient_symptoms', [])
    except json.JSONDecodeError:
        pass

    return result_text, normalized_symptoms


# ===========================
# Main Execution
# ===========================
if __name__ == "__main__":
    print("\n🤖 MedGemma Medical Assistant\n")
    user_input = "Başım ağrıyor ve midem bulanıyor"

    answer, symptoms = ask_medgemma(user_input)

    print("\n==================== AI YANITI ====================")
    print(answer)

