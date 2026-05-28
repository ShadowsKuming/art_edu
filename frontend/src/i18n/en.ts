export default {
  lang: 'EN',
  brand: {
    name: 'ArtBloom',
  },
  home: {
    nav: {
      home: 'Home',
      tutorial: 'Tutorial',
      contact: 'Contact',
      access: 'Access',
    },
    access: {
      title: 'Access with Invitation Code',
      subtitle:
        'Use the code provided by the research team to access ArtBloom',
      placeholder: 'Type Invitation Code',
      submit: 'Enter ArtBloom',
      closeAria: 'Close access dialog',
    },
    hero: {
      titleArt: 'Art',
      titleBloom: 'Bloom',
      description:
        'An AI teaching workflow for primary art classrooms, helping teachers move smoothly across lesson preparation, instruction, creative guidance, and feedback.',
      captionTopRight: 'Start from the textbook, then build stories and interaction.',
      captionBottomRight: 'Provide visible guidance and feedback during making.',
      mainImageAlt: 'ArtBloom hero illustration',
      photo1Alt: 'Teacher preparing a lesson on a laptop',
      photo2Alt: 'Children drawing with crayons in class',
      photo3Alt: 'Teacher and students in an art classroom',
    },
    tutorial: {
      title: 'Tutorial',
      subtitle:
        'Start from the textbook and build a structured lesson deck step by step for classroom teaching.',
      intro:
        'ArtBloom is not a traditional slide editor, but a teaching workflow system designed around lesson preparation, classroom delivery, and in-class support.',
      introBold: 'ArtBloom',
      bannerAlt: 'Tutorial overview banner',
      steps: [
        {
          title: 'Choose a textbook lesson',
          body: 'Select the grade, volume, unit and lesson you want to teach.',
        },
        {
          title: 'Author with AI Assistance',
          body: 'Use ArtBloom for text suggestions, story, animation generation, and page-level refinement.',
        },
        {
          title: 'Build a structured slide deck',
          body: 'Edit your lesson within a guided page structure for classroom use.',
        },
        {
          title: 'Preview the lesson',
          body: 'Check page order, media playback, and interaction flow before entering teaching mode.',
        },
        {
          title: 'Start teaching',
          body: 'Launch the completed lesson directly in presentation mode for classroom teaching.',
        },
      ],
    },
    contact: {
      title: 'Contact Us',
      subtitle:
        'If you have any questions about using ArtBloom, participating in the pilot, research collaboration, or sharing feedback, please get in touch with the research team.',
      bannerAlt: 'Get in touch banner',
      helpTitle: 'How We Can Help',
      helpItems: [
        {
          title: 'Access Support',
          body: 'Invitation code, login, lesson editing, and teaching-mode issues',
        },
        {
          title: 'Research collaboration',
          body: 'Pilot studies, school partnerships, and academic exchange',
        },
        {
          title: 'Feedback',
          body: 'Feature suggestions, bug reports, and user experience comments',
        },
      ],
      emailLabel: 'Email',
      // 2026-05 — vue-i18n treats `@` as the start of "linked
      // message" syntax (`@:foo`, `@.upper`, `@@`). The production
      // build of vue-i18n's message compiler throws
      // `SyntaxError: Invalid linked format` when `@` is followed by
      // anything else (here: `163.com`). That kills `<ContactInfoCard>`
      // at setup and cascades into `<ContactForm>` not rendering on
      // the deployed homepage. Dev only warns, hence "works on local
      // host". Escape with the `{'@'}` literal interpolation — the
      // rendered text is still `machi2019uk@163.com`.
      emailValue: "machi2019uk{'@'}163.com",
      wechatLabel: 'WeChat',
      wechatValue: 'chi_chi_131',
      form: {
        nameLabel: 'Name',
        namePlaceholder: 'Your full name',
        // Legacy keys kept for backwards compatibility (no longer rendered).
        firstNamePlaceholder: 'First Name',
        lastNamePlaceholder: 'Last Name',
        emailLabel: 'Email',
        // 2026-05 — placeholder examples updated to a Chinese mailbox
        // + +86 mobile-format example so the form mirrors the
        // pilot's actual users. Pure cosmetic placeholder copy.
        // Same escape as `emailValue` above — avoids vue-i18n's
        // linked-format parser tripping on `@`.
        emailPlaceholder: "1234567890{'@'}163.com",
        phoneLabel: 'Phone',
        phonePlaceholder: '+86 12345678900',
        messageLabel: 'Message',
        messagePlaceholder: 'Write your message…',
        send: 'Send',
        required: 'Required',
      },
    },
  },
  nav: {
    back: 'Back',
    previewLesson: 'Preview Lesson',
    startTeaching: 'Start Teaching',
  },
  lessonSelect: {
    title: 'Select a textbook lesson to start lesson-prep',
    grade: 'Grade {n}',
    volume: 'Volume {n}',
    unit: 'Unit {n}',
    lesson: 'Lesson {n}',
    backToVolumes: 'Back to volume picker',
    closeAria: 'Close lesson selection',
    volumeAria: 'Open Grade {grade}, Volume {volume}',
  },
  community: {
    title: 'Community',
    subtitle:
      'Browse shared slide decks and example lessons to inspire your teaching.',
    backToDashboard: 'Back to Dashboard',
    heroAlt: 'Decorative painted shapes',
    gridAria: 'Shared lesson decks',
    filters: {
      aria: 'Filter community lessons',
      gradeLevel: 'Grade Level',
      unit: 'Unit',
      lesson: 'Lesson',
      allGrades: 'All Grades',
      allUnits: 'All Units',
      allLessons: 'All Lessons',
      discover: 'Discover',
    },
    card: {
      preview: 'Preview',
      save: 'Save',
      saved: 'Saved',
      unitLessonShort: 'Unit {unit} • Lesson {lesson}',
    },
    team: 'ArtBloom Team',
    preview: {
      title: 'Lesson Preview',
      slideOf: 'Part {part} · Slide {n}',
      close: 'Close',
      empty: 'This lesson has no slides yet.',
    },
    save: {
      savedToMyLessons: 'Saved to My Lessons',
      alreadySaved: 'Already in My Lessons',
    },
    pagination: {
      aria: 'Pagination',
      prev: 'Previous page',
      next: 'Next page',
    },
  },

  dashboardHub: {
    title: 'Dashboard',
    subtitle:
      'Welcome to the ArtBloom dashboard. Here, you can create slide decks, manage your teaching materials, and quickly return to your daily lesson preparation and teaching workflow.',
    greeting: 'Hi, {name}',
    homeAriaLabel: 'Return to homepage',
    dashboardAriaLabel: 'Go to dashboard',
    accountAriaLabel: 'Open my account',
    avatarAlt: 'User avatar',
    heroAlt: 'Decorative painted shapes illustration',
    entryAriaLabel: 'Open {title}',
    cards: {
      createLesson: {
        title: 'Create Lesson',
        description: 'Start from a textbook lesson to create a new structured slide deck.',
      },
      myLessons: {
        title: 'My Lessons',
        description: 'View, edit, manage the slide decks you have created, saved, or are currently using.',
      },
      community: {
        title: 'Community',
        description: 'Browse shared slide decks and add useful lessons to your own teaching workflow.',
      },
      startTeaching: {
        title: 'Start Teaching',
        description: 'Quickly choose a completed slide deck and begin teaching.',
      },
      myAccount: {
        title: 'My Account',
        description: 'View your account details and share feedback.',
      },
    },
    // 2026-05 — Right-side drawer opened by the "Start Teaching" hub
    // card. Empty state and populated state share these keys; the
    // component swaps layouts based on `projects.length`.
    startTeachingDrawer: {
      title: 'Start Teaching',
      subtitle:
        'Pick a completed or recently-used lesson to jump into teaching mode.',
      readyToTeach: 'Ready to Teach',
      recentlyUsed: 'Recently Used',
      startTeaching: 'Start Teaching',
      preview: 'Preview',
      closeAria: 'Close drawer',
      empty: {
        title: 'No lessons yet',
        body: 'Create your first art lesson to get started.',
        create: 'Create Lesson',
      },
    },
  },
  account: {
    title: 'My Account',
    backToDashboard: 'Back to Dashboard',
    welcome: 'Welcome, {name}',
    subtitle: 'Manage your profile, share feedback, and stay inspired.',
    decorAlt: 'Decorative collage of teachers and pupils',
    profile: {
      displayName: 'Display Name',
      displayNamePlaceholder: 'Add a display name',
      bio: 'Teaching Motto',
      bioPlaceholder: 'Share a short teaching motto or bio…',
      editAvatarAria: 'Edit avatar',
    },
    inviteCode: {
      label: 'Invitation Code',
    },
    feedback: {
      title: 'Help us improve ArtBloom',
      body: 'We would love to hear what is working and what is not. Your feedback shapes the next version of ArtBloom.',
      send: 'Send Feedback',
    },
    quote: {
      text: '“Every child is an artist. The problem is how to remain an artist once we grow up.” — Pablo Picasso',
    },
    picker: {
      title: 'Choose your avatar',
      ariaLabel: 'Avatar picker',
      closeAria: 'Close avatar picker',
    },
  },
  dashboard: {
    myLessons: 'My Lessons',
    subtitle: 'View, edit, manage, and start teaching with the slide decks you have created, saved, or are currently using.',
    createLesson: 'Create Lesson',
    newLesson: '+ New Lesson',
    noLessons: 'No lessons yet',
    noLessonsDesc: 'Create your first art lesson to get started.',
    partProgress: 'Part {n} of 7',
    resume: 'Resume',
    deleteLesson: 'Delete lesson',
    untitled: 'Untitled Lesson',
    slides: 'Slides',
    created: 'Created',
    stats: {
      totalSlides: 'Total Slides',
      totalSlidesDesc: 'All your created slides',
      readyToTeach: 'Ready to Teach',
      readyToTeachDesc: 'Published and ready',
      drafts: 'Drafts',
      draftsDesc: 'In progress',
      shared: 'Shared',
      sharedDesc: 'Shared with others',
    },
    tabs: {
      all: 'All Lessons',
      completed: 'Completed',
      drafts: 'Drafts',
      saved: 'Saved',
      taught: 'Taught',
    },
    col: {
      deck: 'Slide Deck',
      unit: 'Unit / Lesson',
      lastEdited: 'Last Edited',
      status: 'Status',
      actions: 'Actions',
    },
    actions: {
      edit: 'Edit',
      preview: 'Preview',
      startTeaching: 'Start Teaching',
      delete: 'Delete',
    },
    modal: {
      newTitle: 'New Lesson',
      namePlaceholder: 'Lesson name',
      cancel: 'Cancel',
      create: 'Create',
      deleteTitle: 'Delete lesson?',
      deleteDesc: 'This cannot be undone.',
      delete: 'Delete',
    },
  },
  sidebar: {
    pageList: 'Page List',
    deleteSlide: 'Delete slide',
    // Sidebar part titles — copy provided by the curriculum team
    // (2026-05). These supersede the earlier descriptive translations
    // so both locales share the canonical curriculum phrasing.
    parts: [
      'Part 1: Lesson Introduction',
      'Part 2: New Knowledge',
      'Part 3: Story Animation',
      'Part 4: Classroom Practice',
      'Part 5: Creative Demonstration',
      'Part 6: Style Creation',
      'Part 7: Showcase & Review',
    ],
  },
  content: {
    fontFamily: 'Font Family',
    weight: 'Weight',
    size: 'Size',
    alignment: 'Alignment',
    textColor: 'Text Color',
    flip: 'Flip',
    noSelection: 'Click Tt to add text, or select an element to edit.',
    noSlide: 'Add a slide to get started.',
    save: 'Save',
    saveNext: 'Save & Next',
    defaultText: 'Double-click to edit',
    imageMenu: {
      addAsElement: 'Add as element',
      uploadImage: 'Upload image',
      generateImage: 'Generate an image',
      slideBackground: 'Slide background',
      uploadBackground: 'Upload background',
      solidColor: 'Solid color',
      resetToGlobal: 'Reset to global theme',
    },
  },
  part3: {
    emptyState: 'Click + in the sidebar to add your first artwork',
    uploadLabel: 'Click to upload artwork image',
    // Canvas placeholder when the user has not yet picked an
    // artwork. Copy was reworded to point at the *left sidebar*
    // (where the curated thumbnails live) rather than "above",
    // which was misleading after the layout settled.
    uploadOrPick: 'Pick a textbook illustration from the left to generate its story and animation',
    pickArtworkLabel: 'Curated artworks for this lesson',
    loadingArtwork: 'Loading artwork…',
    replaceImage: 'Replace image',

    remainingAttempts: 'Remaining animation attempts: {n} / 3',
    generateStory: 'Generate Story',
    story: 'Story',
    generating: 'Generating…',
    generateAnimation: 'Generate Animation',
    animation: 'Animation',
    processing: 'Processing…',
    failed: 'Failed',
    animationN: 'Animation {n}',
    selectVersionHint: 'Select an animation version to continue',
    save: 'Save',
    saveNext: 'Save & Next',
    storyPanel: {
      storyPreview: 'Story Preview',
      designRationale: 'Design Rationale',
      soundDesign: 'Sound Design',
      generatingStory: 'Generating story from your artwork…',
      // Kept as an empty string so any caller binding to this key
      // still resolves (no missing-key warnings), but the empty
      // state in Part3StoryPanel no longer renders a hint line.
      uploadHint: '',
      part1Title: 'Part 1: First Half of the Story',
      part2Title: 'Part 2: Interactive Choices',
      choicesHint: 'Please choose how you would like the story to continue:',
      part3Title: 'Part 3: Second Half',
      generatingCont: 'Generating continuation…',
      choosePathHint: 'Choose a path above to generate the second half of the story.',
      ttsTitle: 'Story Narration',
      ttsNoText: 'Generate a story first to enable narration.',
      ttsSegmentLabel: 'Read segment:',
      ttsSegmentPart1: 'Opening (Part 1)',
      ttsSegmentPart3: 'Continuation (Part 3)',
      ttsPart3NotReady: 'Pick a path in Story Preview first to generate the continuation.',
      ttsVoiceLabel: 'Choose a voice:',
      ttsPlay: 'Play',
      ttsPause: 'Pause',
      ttsStop: 'Stop',
      ttsPlaying: 'Playing…',
      ttsPaused: 'Paused',
      ttsReady: 'Ready',
      ttsLoading: 'Preparing audio…',
      ttsBright: 'Bright',
      ttsWarm: 'Warm',
      ttsGentle: 'Gentle',
      ttsCrisp: 'Crisp',
      ttsDeep: 'Deep',
      ttsNatural: 'Natural',
      // 2026-05: the legacy `aiSuggestionsTitle` + the `soundDesign`
      // story field have been retired. The video model has no audio
      // output and teachers told us in pilot interviews they never
      // acted on the AI sound suggestions, so we removed it from
      // both the story JSON schema and the Sound Design tab UI to
      // shave 1-2 seconds off story generation latency. The Sound
      // Design tab now hosts only the TTS narration controls.
      // Design Rationale tab AI co-revision chat (2026-05 pilot).
      chatTitle: 'Discuss & revise with AI',
      chatHint: 'Try "make paragraph 2 more sensory" or "make branch 3 gentler".',
      chatPlaceholder: 'What would you like to change?',
      chatSend: 'Send',
      chatSending: 'Thinking…',
      chatEmpty: 'No conversation yet. Try one of the examples above, or ask me anything about the story.',
      chatRevisedTitle: 'Revised story',
      chatRevisedHint: 'Keep iterating below, or click "Apply this version" to replace the Story Preview with this draft.',
      chatRevisedPart1: 'Part 1: Opening',
      chatRevisedPart2: 'Part 2: Interactive Choices',
      chatRevisedPart3: 'Part 3: Continuation',
      chatRevisedDesign: 'Design Rationale',
      chatApply: 'Apply this version',
      chatApplied: 'Applied',
      chatViewStory: 'View Story Preview ›',
      chatStoryUpdated: 'Story updated',
    },
    // Right-side panel that lets the teacher iterate on the
    // generated animation. Title intentionally reuses
    // `chatbot.title` ("Creative Assistant") for brand consistency,
    // so only the body / chips / placeholders live here.
    animationPanel: {
      greeting: 'Each image has three chances to generate an animation. Click Generate Animation to create the first version, or enter custom instructions below.',
      suggestionsLabel: 'Would you like to modify and regenerate? For example:',
      suggestions: [
        'Make the atmosphere of the animation more cheerful',
        'Add changes in light and shadow',
        'Zoom in for a close-up of the main subject',
      ],
      acknowledge: 'Got it! Generating a new animation with your adjustments: "{prompt}". This may take a minute…',
      generating: 'Generating animation…',
      noAttempts: 'No animation attempts remaining for this image.',
      inputPlaceholder: 'Enter any animation content you would like to adjust…',
    },
  },
  chatbot: {
    title: 'Creative Assistant',
    // `subtitle` is no longer rendered in WorkspaceChatbot (the title
    // itself is now "Creative Assistant"), but the key is kept so any
    // future surface that needs a secondary line still has a string.
    subtitle: 'Creative Assistant',
    placeholder: 'Ask questions about the slide design…',
    error: 'Sorry, something went wrong. Please try again.',
    // Fallback greeting/chips for parts that don't have their own
    // tailored copy yet (e.g. when activePart hasn't been resolved,
    // or for parts 3/6/7 which use dedicated side panels but still
    // share this string table).
    fallback: {
      greeting: 'Hi, I am ArtBloom! Ask me anything about the slide design. For example:',
      suggestions: [
        'What are the learning objectives of this lesson?',
        'What colour tone works best for this slide deck?',
        'How can I make this slide deck more engaging for students?',
      ],
    },
    // 2026-05 — Pilot feedback: the previous shared greeting + chips
    // pushed the model toward generic answers. Each of parts 1/2/4/5
    // now has its own greeting + 3 chips scoped to the actual
    // pedagogical role of that page. We deliberately avoid asking
    // questions the model cannot answer (e.g. "where can I find
    // images") so suggestions and replies stay coherent.
    byPart: {
      1: {
        greeting:
          'Hi, I am ArtBloom! Ask me anything about designing the lesson-opening slide. For example:',
        suggestions: [
          'How do I design an opening slide that grabs students\' attention?',
          'Which visual elements and colour palettes work well for a lesson opener?',
          'What kinds of curiosity-sparking questions should the opening slide pose?',
        ],
      },
      2: {
        greeting:
          'Hi, I am ArtBloom! Ask me anything about designing the new-content slide. For example:',
        suggestions: [
          'Which art concepts are the focus of this lesson?',
          'How do I break the core knowledge into steps students can follow?',
          'How should I balance text, images and demo art on the new-content slide?',
        ],
      },
      4: {
        greeting:
          'Hi, I am ArtBloom! Ask me anything about designing the classroom-practice slide. For example:',
        suggestions: [
          'How can I structure the hands-on activity for this lesson?',
          'What tools and materials should be prepared for the practice?',
          'How do I write step-by-step instructions students can follow on their own?',
        ],
      },
      5: {
        greeting:
          'Hi, I am ArtBloom! Ask me anything about designing the creative-demo slide. For example:',
        suggestions: [
          'Which steps of the teacher\'s demo should be highlighted most clearly?',
          'What close-up details should the demo slide include so students see key techniques?',
          'How do I narrate the demo so students can follow along step by step?',
        ],
      },
    },
  },

  // Part 5 — Making Example. Slide embeds a curated Bilibili tutorial
  // by default; 2026-05-27 onward teachers can also upload a local
  // clip or paste their own URL (see Part5Content.vue for details).
  part5: {
    // Slide H1 mirrors the sidebar label from `sidebar.parts[4]`
    // (curriculum-team copy, 2026-05).
    slideTitle: 'Creative Demonstration',
    upload: {
      localBtn: 'Upload Local Video',
      urlBtn: 'Paste Video URL',
      restoreBtn: 'Restore Default',
      defaultLabel: 'Playing: default demonstration video',
      urlPlaceholder: 'Paste a Bilibili link, BV id, or direct mp4 URL',
      urlConfirm: 'Use this link',
    },
    errors: {
      notVideo: 'Please choose a video file (mp4 / mov / webm).',
      tooLarge: 'Video must be smaller than 200 MB.',
      badUrl: 'Please enter a valid video URL or Bilibili BV id.',
    },
    toasts: {
      uploaded: 'Replaced with your local video.',
      urlSet: 'Replaced with the provided URL.',
      restored: 'Restored the default demonstration video.',
    },
  },

  part7: {
    noLessonTitle: 'Part 7 needs a curriculum lesson',
    noLessonHint:
      'Open a lesson from Community (or create one) — Part 7 uses the lesson rubric to ground student-work feedback.',
    studentWorks: 'Student Works',
    studentWorksHint:
      'Upload a photo of a student\'s in-progress or finished work. Choose a thumbnail to comment on it.',
    uploadLabel: 'Upload student work',
    removeWork: 'Remove this work',
    selectWork: 'Select a student work on the left to begin.',
    studentNote: 'Student note (optional)',
    studentNotePh: 'e.g. "Bunny climbing a long ladder to pick the moon."',
    // 2026-05 — re-labelled per pilot feedback. The button is the
    // teacher's action ("get a critique"), not a system action
    // ("generate AI feedback"). "Critique" matches how art teachers
    // actually talk about evaluating student work.
    generate: 'Get a Critique',
    regenerate: 'Get a New Critique',
    generating: 'Generating…',
    feedbackHeading: 'AI Feedback',
    wordCount: '{n} words',
    dimensionsCovered: 'Covered:',
  },
  part6: {
    step1Label: 'Step 1: Upload a sketch or unfinished work',

    uploadLabel: 'Upload Student Work',
    selectFiles: 'Select Files',
    replace: 'Replace',
    step2Label: "Step 2: Choose a style and unlock your artwork's potential!",
    generatingStyles: 'Generating style options…',
    stylesHint: 'Chat with ArtBloom to pick the art style that best fits this lesson!',
    convertBtn: 'Converting!',
    allUsed: 'All styles have been used. Upload a new work to try again.',
    // 2026-05: shown when the teacher has confirmed a style triple
    // via the chat panel but has not yet uploaded a sketch in Step 1.
    uploadFirst: 'Upload a student work above before starting the conversion.',
    // 2026-05 v2 — Teacher preview vs Classroom mode toggle + toast.
    previewModeLabel: 'Teacher Preview',
    classroomModeLabel: 'Classroom Mode',
    modeToggleAria: 'Choose teacher preview or classroom mode',
    previewModeHint: 'In Teacher Preview you can re-test each style as many times as you like — perfect for lesson prep.',
    classroomModeHint: 'Switched to Classroom Mode: each style can be transformed only once.',
    teacherPreviewHint: 'Switched to Teacher Preview: re-test each style freely.',
    reopenDiscussion: 'Reopen style discussion',
    convertingOverlay: 'Converting...',
    convertAgain: 'Convert again',
    save: 'Save',
    saveNext: 'Save & Next',
    // 2026-05 chat redesign — see zh.ts for the rationale. The bot
    // already knows the lesson from the LKP, so the teacher picks
    // one of three intent chips (or chats freely). Legacy keys
    // were removed.
    bot: {
      greeting:
        "Hi! I'm ArtBloom. Let's design a personalised style-transfer plan for this lesson. You can pick one of:",
      intents: {
        recommend: 'Recommend a style-transfer plan for this lesson',
        skills: 'What creative skills should students master in this lesson?',
        styles: 'What art style does this lesson focus on?',
      },
      confirmStyles: 'Confirm this set',
      stylesConfirmed: 'Confirmed ✓',
      // 2026-05 — "prompt preview" box rendered under the chips when
      // the teacher clicks one. Shows the curriculum/AI-authored
      // Chinese version of the prompt so the teacher can review it
      // before applying. `{name}` is the chip's label.
      previewLabel: 'Prompt preview · {name}',
      previewEmpty: 'No Chinese prompt available for this style yet.',
      errorChat: 'Sorry, something went wrong. Please try again.',
    },
  },
}
