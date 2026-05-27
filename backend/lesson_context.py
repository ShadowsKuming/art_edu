"""
LessonContextManager — the conceptual "Commander" of the ArtBloom
multi-agent pipeline.

It owns nothing more sophisticated than:

1. A filesystem cache of LKP (Lesson Knowledge Package) JSON files
   under ``backend/data/lessons/``.
2. Per-Part helpers that *return prompt fragments* the main FastAPI
   endpoints append to their existing system prompts.

There are deliberately no agent frameworks, no RAG, no vector stores —
spec is firm about this (see Engineer_Claude_Code_Guide.md §6 and
ArtBloom_Pilot_Feature_Spec.md §10).

Public entry point::

    from lesson_context import lesson_manager

The four Executor build helpers (``build_executor_a_context``,
``build_executor_b_context``, ``build_executor_c_context``,
``build_executor_d_context``) plus ``build_part7_comment_context`` map
1:1 to the conceptual Executors described in
ArtBloom_New_API_Spec.md §2.2.
"""

import json
from pathlib import Path
from typing import Optional

from lesson_types import LessonSeedData


LESSONS_DIR = Path(__file__).parent / "data" / "lessons"


class LessonContextManager:
    """Singleton-style loader; lessons are cached after first load."""

    def __init__(self) -> None:
        self._cache: dict[str, LessonSeedData] = {}

    # ────────────────────────────────────────────────────────────────
    # Disk I/O
    # ────────────────────────────────────────────────────────────────

    def load(self, lesson_id: str) -> LessonSeedData:
        """Load (and validate) a single LKP. ValueError on miss / bad."""
        if lesson_id in self._cache:
            return self._cache[lesson_id]

        path = LESSONS_DIR / f"{lesson_id}.json"
        if not path.exists():
            raise ValueError(f"Lesson seed not found: {lesson_id}")

        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)

        seed = LessonSeedData(**data)
        self._validate(seed)
        self._cache[lesson_id] = seed
        return seed

    def list_available(self) -> list[str]:
        if not LESSONS_DIR.exists():
            return []
        return sorted(p.stem for p in LESSONS_DIR.glob("*.json"))

    def _validate(self, seed: LessonSeedData) -> None:
        # slide_framework must cover parts 1-7
        part_ids = {entry.part_id for entry in seed.slide_framework}
        if part_ids != {1, 2, 3, 4, 5, 6, 7}:
            raise ValueError(
                f"slide_framework must cover parts 1-7, got {sorted(part_ids)}"
            )

        # default artwork must exist
        if seed.textbook_artworks:
            ids = {a.artwork_id for a in seed.textbook_artworks}
            if seed.default_executor_b_artwork_id and seed.default_executor_b_artwork_id not in ids:
                raise ValueError(
                    f"default_executor_b_artwork_id "
                    f"{seed.default_executor_b_artwork_id!r} not in textbook_artworks"
                )

        # executor_d_styles must have exactly 3 (when branch A); branch B may be empty
        if seed.executor_d_styles.branch == "A" and len(seed.executor_d_styles.styles) != 3:
            raise ValueError(
                f"executor_d_styles.styles must have 3 items for branch A, "
                f"got {len(seed.executor_d_styles.styles)}"
            )

    # ────────────────────────────────────────────────────────────────
    # Executor A — slide-design chatbot (Parts 1/2/4/5)
    # ────────────────────────────────────────────────────────────────

    def build_executor_a_context(self, lesson_id: str, part_id: int) -> str:
        """Returns a system-prompt fragment for the chatbot on Parts 1/2/4/5.

        For Parts 3, 6 and 7 returns ``""`` — they go through Executors
        B/C, D, and the dedicated Part 7 commenter respectively.
        """
        seed = self.load(lesson_id)
        prompts = seed.executor_a_part_prompts

        if part_id == 1:
            return prompts.part1
        if part_id == 2:
            return prompts.part2
        if part_id == 4:
            return prompts.part4
        if part_id == 5:
            return prompts.part5
        return ""

    # ────────────────────────────────────────────────────────────────
    # Executor B — Story generation (Part 3)
    # ────────────────────────────────────────────────────────────────

    def build_executor_b_context(
        self, lesson_id: str, artwork_id: Optional[str] = None
    ) -> dict:
        """
        Build the full lesson context dict for Executor B (story generation).

        v2 (2026-05): expanded to include the three-tier learning
        objectives, teaching focus/difficulty, assessment criteria, and
        per-artwork visual description + teacher-guide notes. Without
        these the model only had the unit big idea + a one-line story
        hint, which made stories drift away from the curriculum.

        Returns are flat enough that ``main.py._build_story_lesson_context``
        can just template-format them into the system prompt.
        """
        seed = self.load(lesson_id)
        chosen = artwork_id or seed.default_executor_b_artwork_id

        artwork = next(
            (a for a in seed.textbook_artworks if a.artwork_id == chosen), None
        )
        if artwork is None:
            raise ValueError(f"Artwork {chosen!r} not in lesson {lesson_id}")

        return {
            # Artwork-level
            "artwork": artwork.model_dump(),
            "story_hint": artwork.executor_b_prompt_hint_zh,
            "visual_description": artwork.visual_description_zh,
            "teacher_guide_notes": artwork.teacher_guide_notes_zh,
            # Lesson-level metadata
            "learning_task": seed.learning_task_zh,
            "unit_idea": seed.unit_big_idea_zh,
            "key_concepts": seed.key_art_concepts,
            "lesson_title_zh": seed.lesson_title_zh,
            # Pedagogy (new in v2)
            "learning_objectives": seed.learning_objectives or {},
            "teaching_focus": seed.teaching_focus_zh,
            "teaching_difficulty": seed.teaching_difficulty_text(),
            "assessment_criteria": seed.assessment_criteria_text(),
        }

    # ────────────────────────────────────────────────────────────────
    # Executor C — Animation generation (Part 3 video)
    # ────────────────────────────────────────────────────────────────

    def build_executor_c_context(
        self, lesson_id: str, artwork_id: Optional[str] = None
    ) -> dict:
        seed = self.load(lesson_id)
        chosen = artwork_id or seed.default_executor_b_artwork_id

        artwork = next(
            (a for a in seed.textbook_artworks if a.artwork_id == chosen), None
        )
        if artwork is None:
            raise ValueError(f"Artwork {chosen!r} not in lesson {lesson_id}")

        return {
            "artwork_url": artwork.image_url,
            "mood": seed.animation_default_mood,
            # Per-artwork visual brief (preferred). Empty string when
            # the LKP has not been authored with a brief yet, in which
            # case the caller falls back to `mood`.
            "animation_brief_en": artwork.animation_brief_en,
            "animation_brief_zh": artwork.animation_brief_zh,
        }

    # ────────────────────────────────────────────────────────────────
    # Executor D — Style transfer (Part 6)
    # ────────────────────────────────────────────────────────────────

    def build_executor_d_context(self, lesson_id: str) -> dict:
        seed = self.load(lesson_id)
        return {
            "branch": seed.executor_d_styles.branch,
            "styles": [s.model_dump() for s in seed.executor_d_styles.styles],
            "lesson_summary": f"{seed.lesson_title_zh} — {seed.learning_task_zh}",
        }

    # ────────────────────────────────────────────────────────────────
    # Part 7 commenter
    # ────────────────────────────────────────────────────────────────

    def build_part7_comment_context(self, lesson_id: str) -> dict:
        seed = self.load(lesson_id)
        p7 = seed.executor_a_part_prompts.part7
        return {
            "system_prompt": p7.system_prompt,
            "word_count": tuple(p7.feedback_word_count or [100, 120]),
            "dimensions": p7.feedback_dimensions,
            "tone": p7.encouragement_tone,
            "criteria": seed.assessment_criteria_text(),
            "learning_objectives": seed.learning_objectives,
            "key_concepts": seed.key_art_concepts,
            "lesson_title_zh": seed.lesson_title_zh,
            "learning_task_zh": seed.learning_task_zh,
        }


# Singleton — endpoints import this directly.
lesson_manager = LessonContextManager()
