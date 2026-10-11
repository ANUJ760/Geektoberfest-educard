from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_ai_explain_default_backwards_compatible():
    # Calling without hint_level should default to level 4 (full explanation)
    response = client.post("/api/ai/explain", json={
        "question": "What is the powerhouse of the cell?",
        "user_answer": "Nucleus",
        "correct_answer": "Mitochondria",
        "understanding_level": "ELI5"
    })
    assert response.status_code == 200
    data = response.json()
    assert "explanation" in data
    assert data.get("hint_level") == 4
    # Full explanation must contain the correct answer
    assert "Mitochondria" in data["explanation"]

def test_hint_ladder_levels_1_to_3_do_not_contain_correct_answer():
    question = "What is the capital of France?"
    user_answer = "Berlin"
    correct_answer = "Paris"

    for level in [1, 2, 3]:
        response = client.post("/api/ai/explain", json={
            "question": question,
            "user_answer": user_answer,
            "correct_answer": correct_answer,
            "understanding_level": "Beginner",
            "hint_level": level
        })
        assert response.status_code == 200
        data = response.json()
        assert "explanation" in data
        assert data.get("hint_level") == level
        # Acceptance criteria: levels 1-3 don't contain the correct answer text
        assert correct_answer not in data["explanation"], f"Level {level} hint leaked correct answer!"

def test_hint_ladder_level_4_contains_correct_answer():
    response = client.post("/api/ai/explain", json={
        "question": "What is the capital of France?",
        "user_answer": "Berlin",
        "correct_answer": "Paris",
        "understanding_level": "Intermediate",
        "hint_level": 4
    })
    assert response.status_code == 200
    data = response.json()
    assert "explanation" in data
    assert data.get("hint_level") == 4
    assert "Paris" in data["explanation"]

def test_hint_ladder_with_learner_attempt():
    response = client.post("/api/ai/explain", json={
        "question": "What is the capital of France?",
        "user_answer": "Berlin",
        "correct_answer": "Paris",
        "understanding_level": "Beginner",
        "hint_level": 2,
        "learner_attempt": "Is it near the Seine river?"
    })
    assert response.status_code == 200
    data = response.json()
    assert "explanation" in data
    assert data.get("hint_level") == 2
    assert "Is it near the Seine river?" in data["explanation"]
    assert "Paris" not in data["explanation"]

def test_hint_level_validation_bounds():
    # hint_level < 1 must be rejected with 422
    res_low = client.post("/api/ai/explain", json={
        "question": "What is 2+2?",
        "user_answer": "5",
        "correct_answer": "4",
        "hint_level": 0
    })
    assert res_low.status_code == 422

    # hint_level > 4 must be rejected with 422
    res_high = client.post("/api/ai/explain", json={
        "question": "What is 2+2?",
        "user_answer": "5",
        "correct_answer": "4",
        "hint_level": 5
    })
    assert res_high.status_code == 422
