import os
import json
from typing import List, Dict, Any, Optional
from backend.models import Card, Deck
from backend.rag import retrieve_relevant_context

def generate_ai_deck(topic: str, card_type: str, count: int, materials: List[str]) -> Dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    context = retrieve_relevant_context(topic, materials)
    
    # Try using Google GenAI SDK if key exists
    if api_key:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            prompt = f"""
            Generate a study deck about '{topic}' with {count} cards of type '{card_type}'.
            Here is reference study material/syllabus context:
            {context}
            
            Return ONLY a valid JSON object with this exact structure:
            {{
              "title": "Study Deck Title",
              "description": "Short description",
              "category": "General",
              "cards": [
                {{
                  "type": "flashcard" or "mcq",
                  "question": "Question text",
                  "answer": "Correct answer",
                  "options": ["Option A", "Option B", "Option C", "Option D"] (required only for mcq, else omit or null),
                  "explanation": "Detailed explanation of the correct answer"
                }}
              ]
            }}
            """
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )
            text = response.text.strip()
            # Clean markdown code blocks if present
            if text.startswith("```json"):
                text = text[7:]
            if text.endswith("```"):
                text = text[:-3]
            data = json.loads(text.strip())
            return data
        except Exception as e:
            print(f"Gemini API generation failed, falling back to mock: {e}")

    # Fallback mock generator
    cards = []
    for i in range(1, count + 1):
        if card_type == "mcq" or (card_type == "mixed" and i % 2 == 0):
            cards.append({
                "type": "mcq",
                "question": f"Sample MCQ {i} about {topic}?",
                "answer": "Option A",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "explanation": f"Option A is correct because it directly relates to core concepts of {topic}."
            })
        else:
            cards.append({
                "type": "flashcard",
                "question": f"What is key concept {i} of {topic}?",
                "answer": f"Core definition and mechanism of {topic} part {i}.",
                "options": None,
                "explanation": f"This concept is foundational when studying {topic}."
            })
            
    return {
        "title": f"Mastering {topic}",
        "description": f"AI-generated study deck covering {topic} using uploaded syllabus materials.",
        "category": "Study Deck",
        "cards": cards
    }

def generate_ai_explanation(
    question: str,
    user_answer: str,
    correct_answer: str,
    understanding_level: str,
    hint_level: int = 4,
    learner_attempt: Optional[str] = None
) -> str:
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            attempt_context = f"\nStudent's Recent Attempt / Thought: {learner_attempt}" if learner_attempt else ""

            if hint_level == 1:
                level_instructions = f"""
                Provide a Level 1 Hint: A guiding question that encourages the student to recall the relevant concept or principle on their own.
                STRICT REQUIREMENT: You MUST NOT reveal or hint at the final correct answer ('{correct_answer}') or mention the answer option text directly. Only ask a guiding question.
                """
            elif hint_level == 2:
                level_instructions = f"""
                Provide a Level 2 Hint: A conceptual hint explaining the underlying concept, rule, or mechanism behind the question without giving away the answer.
                STRICT REQUIREMENT: You MUST NOT reveal the final correct answer ('{correct_answer}') or directly state the solution.
                """
            elif hint_level == 3:
                level_instructions = f"""
                Provide a Level 3 Hint: A partial worked step showing how to approach or set up the solution, breaking down the problem partway.
                STRICT REQUIREMENT: You MUST NOT reveal the final correct answer ('{correct_answer}') or the conclusion.
                """
            else:
                level_instructions = f"""
                Provide a Level 4 Full Explanation:
                1. Why the student's answer ({user_answer}) is incorrect.
                2. What the correct answer ({correct_answer}) is and why.
                """

            prompt = f"""
            The student is working on a study question.
            Question: {question}
            Student's Previous Answer: {user_answer}{attempt_context}
            Target Understanding Level: {understanding_level} (e.g. ELI5 = Explain like I am 5, Beginner, Intermediate, Advanced)
            Requested Hint Level: {hint_level} (Scale 1-4)
            
            Instructions:
            {level_instructions}
            Tailor the response precisely to the '{understanding_level}' level.
            """
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )
            return response.text.strip()
        except Exception as e:
            print(f"Gemini explain API failed, using fallback: {e}")

    # Fallback explanation / canned hints
    if hint_level == 1:
        attempt_note = f" Considering your attempt '{learner_attempt}'," if learner_attempt else ""
        return (
            f"Hint Level 1 (Guiding Question):{attempt_note} What fundamental concept or definition is '{question}' asking about? "
            f"Think about the primary role and conditions involved."
        )
    elif hint_level == 2:
        attempt_note = f" Building on your attempt '{learner_attempt}'," if learner_attempt else ""
        return (
            f"Hint Level 2 (Conceptual Hint):{attempt_note} Remember how key mechanisms in this topic interact. "
            f"Identify which principles distinguish valid relationships from invalid ones."
        )
    elif hint_level == 3:
        attempt_note = f" Reviewing your attempt '{learner_attempt}'," if learner_attempt else ""
        return (
            f"Hint Level 3 (Partial Worked Step):{attempt_note} Let's break down '{question}': "
            f"First, eliminate options that contradict the core principles, then evaluate the remaining criteria."
        )
    else:
        return (
            f"At a {understanding_level} level: Your answer '{user_answer}' is not quite right. "
            f"The correct answer is '{correct_answer}'. "
            f"Here's why: EduCards AI notes that '{correct_answer}' satisfies all conditions of the question '{question}'."
        )

