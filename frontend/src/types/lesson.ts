/**
 * TypeScript mirror of the Lesson Knowledge Package (LKP) schema.
 *
 * Source of truth: `backed-files/ArtBloom_Lesson_Data_Schema.md` (§2)
 * and the Python Pydantic version at `backend/lesson_types.py`.
 *
 * The shape is intentionally relaxed to match the v1 JSON files
 * (e.g. `assessment_criteria` may be a list of plain strings rather
 * than the structured objects in the spec).
 */

// ── Nested ─────────────────────────────────────────────────────────

export interface AssessmentCriterion {
    dimension: string
    description_zh: string
    excellent_zh?: string
    acceptable_zh?: string
}

export interface SlideElementSeed {
    type: 'text' | 'image' | 'audio'
    x: number
    y: number
    width: number
    height: number
    /**
     * Single-locale fallback. When `content_en` / `content_zh` are
     * both provided this is ignored (the seeder uses them directly);
     * otherwise it's treated as the literal text.
     */
    content: string
    /**
     * Bilingual variants. When at least one is present, the seeder
     * populates `SlideElement.contentEn` / `.contentZh` so the
     * workspace can swap languages live via the EN/中 header toggle.
     */
    content_en?: string
    content_zh?: string
    fontSize?: number
    fontWeight?: string
    fontFamily?: string
    textAlign?: 'left' | 'center' | 'right'
    color?: string
    src?: string
    flipH?: boolean
    flipV?: boolean
    rotation?: number
    /**
     * Optional CSS `object-fit` for image elements. Defaults to
     * `contain`. Set to `"cover"` for full-bleed design images
     * (cover, scene illustrations) that should fill the bounding box.
     */
    objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
    /**
     * Optional CSS `object-position` (e.g. `"center bottom"` so the
     * image is bottom-anchored under `object-fit: cover`).
     */
    objectPosition?: string
}



export interface SlideFrameworkEntry {
    page: number
    part_id: 1 | 2 | 3 | 4 | 5 | 6 | 7
    section: string
    content_points: string
    asset_types?: string
    default_elements?: SlideElementSeed[]
    default_background?: string
}

export interface TextbookArtwork {
    artwork_id: string
    title_zh: string
    artist_zh: string
    year?: number
    medium_zh: string
    image_url: string
    license_status?: string
    textbook_position?: string
    visual_description_zh?: string
    teacher_guide_notes_zh?: string
    executor_b_prompt_hint_zh?: string
    recommended_for_executor_b?: boolean
    recommended_for_executor_c?: boolean
    narrative_richness?: 'low' | 'medium' | 'high'
    /**
     * 2026-05: per-artwork visual-motion brief written by the
     * curriculum team. Drives Executor C (Doubao Seedance) — the
     * lesson-level `animation_default_mood` is only used as a
     * fallback when the brief is empty.
     */
    animation_brief_zh?: string
    animation_brief_en?: string
}

export interface ExecutorDStyle {
    style_id: number
    style_name_zh: string
    style_description_zh?: string
    linked_learning_objective?: string
    image_gen_prompt_template_en: string
    model_recommendation?: string
}

export interface ExecutorDStyles {
    branch: 'A' | 'B'
    styles: ExecutorDStyle[]
}

export interface ExecutorAPart7Prompt {
    system_prompt: string
    feedback_word_count: [number, number]
    feedback_dimensions: string[]
    encouragement_tone: 'warm' | 'professional' | 'playful'
}

export interface ExecutorAPartPrompts {
    part1: string
    part2: string
    part4: string
    part5: string
    part7: ExecutorAPart7Prompt
}

export interface ClassroomActivity {
    task_zh?: string
    task_en?: string
    duration_minutes?: number
    materials_zh?: string[]
    safety_notes_zh?: string[]
    expected_outcome_zh?: string
}

export interface AudioResource {
    audio_id: string
    title_zh: string
    url: string
    duration_seconds?: number
    usage_in_part?: 2 | 3 | 4
    description_zh?: string
}

// ── Top-level ──────────────────────────────────────────────────────

export interface LessonSeedData {
    // Metadata
    lesson_id: string
    lesson_title_zh: string
    lesson_title_en: string
    unit_id: string
    unit_title_zh?: string
    unit_title_en?: string
    unit_big_idea_zh?: string
    grade?: number
    volume?: 1 | 2
    publisher?: string
    textbook_page_range?: number[]
    teacher_guide_page_range?: number[]

    // Pedagogy
    category?: 'A' | 'B'
    category_reason?: string
    learning_task_zh?: string
    learning_objectives?: Record<string, string>
    key_art_concepts?: string[]
    teaching_focus_zh?: string
    teaching_difficulty_zh?: string | string[]
    driving_question_zh?: string
    guiding_questions_zh?: string[]
    assessment_criteria?: (AssessmentCriterion | string)[]

    // Slide framework
    slide_framework: SlideFrameworkEntry[]

    // Executor B
    textbook_artworks: TextbookArtwork[]
    default_executor_b_artwork_id: string

    // Executor C
    animation_default_mood?: string

    // Executor D
    executor_d_styles: ExecutorDStyles

    // Executor A
    executor_a_part_prompts: ExecutorAPartPrompts

    // Part 5
    example_video_url?: string
    example_video_notes_zh?: string

    // Optional audio assets
    audio_resources?: AudioResource[]

    // Other
    tts_voice_recommendation?: string
    classroom_activity?: ClassroomActivity
    suggested_ai_support_zh?: string
}
