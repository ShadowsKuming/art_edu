"""
Pydantic schemas for ArtBloom Lesson Knowledge Packages (LKP).

Mirrors `frontend/src/types/lesson.ts`. Source of truth: the spec
document `backed-files/ArtBloom_Lesson_Data_Schema.md` (§2.3).

A few field shapes are intentionally relaxed compared to the spec to
match the actual JSON files shipped with the pilot:

* ``teaching_difficulty_zh`` accepts either a single string or a list
  of strings (the v1 JSON for G2V2-U4-L4 ships a list).
* ``assessment_criteria`` accepts either the structured-object form
  described in the spec or a flat list of strings.

These minor relaxations keep the loader strict about *structure* while
not blocking on cosmetic differences between v1 LKP files and the
formal schema.
"""

from typing import Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


# ─── Helpers ───────────────────────────────────────────────────────────


class _LKPModel(BaseModel):
    """Base model that tolerates unknown fields (forward-compat).

    ``protected_namespaces=()`` silences Pydantic's warning about the
    ``model_recommendation`` field on ``ExecutorDStyle`` colliding with
    its built-in ``model_`` namespace — the field name is part of the
    public LKP schema and we don't want to rename it.
    """

    model_config = ConfigDict(extra="ignore", protected_namespaces=())



# ─── Nested ────────────────────────────────────────────────────────────


class AssessmentCriterion(_LKPModel):
    dimension: str
    description_zh: str
    excellent_zh: str = ""
    acceptable_zh: str = ""


class SlideElement(_LKPModel):
    type: Literal["text", "image"]
    x: float
    y: float
    width: float
    height: float
    content: str = ""
    # Optional bilingual variants. When either is set, the frontend
    # uses them for live EN/中 swapping; the plain `content` field is
    # treated as a fallback for legacy/single-locale seeds.
    content_en: Optional[str] = None
    content_zh: Optional[str] = None
    fontSize: Optional[float] = None

    fontWeight: Optional[str] = None
    fontFamily: Optional[str] = None
    textAlign: Optional[Literal["left", "center", "right"]] = None
    color: Optional[str] = None
    src: Optional[str] = None
    flipH: Optional[bool] = None
    flipV: Optional[bool] = None
    rotation: Optional[float] = None


class SlideFrameworkEntry(_LKPModel):
    page: int
    part_id: Literal[1, 2, 3, 4, 5, 6, 7]
    section: str
    content_points: str
    asset_types: str = ""
    default_elements: Optional[list[SlideElement]] = None
    default_background: Optional[str] = None


class TextbookArtwork(_LKPModel):
    artwork_id: str
    title_zh: str
    artist_zh: str
    year: Optional[int] = None
    medium_zh: str
    image_url: str
    license_status: str = ""
    textbook_position: str = ""
    visual_description_zh: str = ""
    teacher_guide_notes_zh: str = ""
    executor_b_prompt_hint_zh: str = ""
    recommended_for_executor_b: bool = True
    recommended_for_executor_c: bool = True
    narrative_richness: Literal["low", "medium", "high"] = "medium"
    # Per-artwork animation brief used by Executor C (Doubao Seedance).
    # Written by the curriculum team, focuses purely on *visual motion*
    # (camera, primary subject, secondary subject, style preservation)
    # — pedagogical filler and music descriptions deliberately removed
    # because the video model can neither understand nor render them.
    # Falls back to `animation_default_mood` when both are empty.
    animation_brief_zh: str = ""
    animation_brief_en: str = ""



class ExecutorDStyle(_LKPModel):
    style_id: int
    style_name_zh: str
    style_description_zh: str = ""
    linked_learning_objective: str = ""
    image_gen_prompt_template_en: str
    # 2026-05: curriculum team now hand-writes a 95-105 Chinese-character
    # equivalent of the English image-gen prompt. It is shown to the
    # teacher in the Part-6 chat panel's "preview box" so they can review
    # the prompt content in Chinese before applying the style (the English
    # version is what actually goes to Doubao Seedream — teachers don't
    # read it). Defaults to "" so older LKPs still load; the chat code
    # falls back to `style_description_zh` in that case.
    image_gen_prompt_template_zh: str = ""
    model_recommendation: str = ""


class ExecutorDStyles(_LKPModel):
    branch: Literal["A", "B"]
    styles: list[ExecutorDStyle]


class ExecutorAPart7Prompt(_LKPModel):
    system_prompt: str
    feedback_word_count: list[int] = Field(default_factory=lambda: [100, 120])
    feedback_dimensions: list[str] = Field(default_factory=list)
    encouragement_tone: Literal["warm", "professional", "playful"] = "warm"


class ExecutorAPartPrompts(_LKPModel):
    part1: str = ""
    part2: str = ""
    part4: str = ""
    part5: str = ""
    part7: ExecutorAPart7Prompt


class ClassroomActivity(_LKPModel):
    task_zh: str = ""
    task_en: str = ""
    duration_minutes: int = 20
    materials_zh: list[str] = Field(default_factory=list)
    safety_notes_zh: list[str] = Field(default_factory=list)
    expected_outcome_zh: str = ""


class AudioResource(_LKPModel):
    audio_id: str
    title_zh: str
    url: str
    duration_seconds: int = 0
    usage_in_part: Literal[2, 3, 4] = 2
    description_zh: str = ""


# ─── Top-level seed ────────────────────────────────────────────────────


class LessonSeedData(_LKPModel):
    """One Lesson Knowledge Package (LKP) — a single seed lesson."""

    # 1. Metadata
    lesson_id: str
    lesson_title_zh: str
    lesson_title_en: str
    unit_id: str
    unit_title_zh: str = ""
    unit_title_en: str = ""
    unit_big_idea_zh: str = ""
    grade: int = 0
    volume: Literal[1, 2] = 1
    publisher: str = ""
    textbook_page_range: list[int] = Field(default_factory=list)
    teacher_guide_page_range: list[int] = Field(default_factory=list)

    # 2. Pedagogy
    category: Literal["A", "B"] = "A"
    category_reason: str = ""
    learning_task_zh: str = ""
    learning_objectives: dict = Field(default_factory=dict)  # {know, understand, do}
    key_art_concepts: list[str] = Field(default_factory=list)
    teaching_focus_zh: str = ""
    # Accept either a single string or a list (v1 file uses a list).
    teaching_difficulty_zh: Union[str, list[str]] = ""
    driving_question_zh: str = ""
    guiding_questions_zh: list[str] = Field(default_factory=list)
    # Accept either structured objects or flat strings (v1 file uses strings).
    assessment_criteria: Union[list[AssessmentCriterion], list[str]] = Field(default_factory=list)

    # 3. Slide framework
    slide_framework: list[SlideFrameworkEntry] = Field(default_factory=list)

    # 4. Executor B (Story)
    textbook_artworks: list[TextbookArtwork] = Field(default_factory=list)
    default_executor_b_artwork_id: str = ""

    # 5. Executor C (Animation)
    animation_default_mood: str = "gentle, dreamy"

    # 6. Executor D (Style transfer)
    executor_d_styles: ExecutorDStyles

    # 7. Executor A (Part-specific prompts + Part 7 commenter)
    executor_a_part_prompts: ExecutorAPartPrompts

    # 8. Part 5
    example_video_url: str = ""
    example_video_notes_zh: str = ""

    # 9. Optional audio assets
    audio_resources: Optional[list[AudioResource]] = None

    # 10. Suggestion fields
    tts_voice_recommendation: str = "zh-CN-XiaoxiaoNeural"
    classroom_activity: Optional[ClassroomActivity] = None
    suggested_ai_support_zh: str = ""

    # ────────────────────────────────────────────────────────────────
    # Convenience normalisers — keep downstream code simple.
    # ────────────────────────────────────────────────────────────────

    def teaching_difficulty_text(self) -> str:
        """Always returns the difficulty as a single string."""
        v = self.teaching_difficulty_zh
        if isinstance(v, list):
            return "\n".join(v)
        return v or ""

    def assessment_criteria_text(self) -> list[str]:
        """Returns a flat list of human-readable criterion strings."""
        out: list[str] = []
        for c in self.assessment_criteria:
            if isinstance(c, str):
                out.append(c)
            elif isinstance(c, AssessmentCriterion):
                out.append(c.description_zh or c.dimension)
        return out
