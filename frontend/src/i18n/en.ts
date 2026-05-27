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
      emailValue: 'machi2019uk@163.com',
      wechatLabel: 'WeChat',
      wechatValue: 'chi_chi_131',
      form: {
        nameLabel: 'Name',
        firstNamePlaceholder: 'First Name',
        lastNamePlaceholder: 'Last Name',
        emailLabel: 'Email',
        emailPlaceholder: 'b*************.com',
        phoneLabel: 'Phone',
        phonePlaceholder: '+1(480) 555-0103',
        messageLabel: 'Comment or Message',
        send: 'Send Message',
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
      chatRevisedTitle: "I've prepared a revised version",
      chatRevisedHint: 'Click apply to replace the story on the left. The old version stays in this chat for reference.',
      chatApply: 'Apply this version',
      chatApplied: 'Applied',
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
    greeting: 'Hi, I am ArtBloom! Ask me anything about the slide design. For example:',
    suggestions: [
      'What are the learning objectives of this lesson?',
      'What colour tone works best for this slide deck?',
      'Where can I find images for this lesson?',
    ],
    placeholder: 'Ask questions about the slide design…',
    error: 'Sorry, something went wrong. Please try again.',
  },
  // Part 5 — Making Example. Slide now embeds a curated Bilibili
  // tutorial via iframe; the local-upload UI was retired during the
  // pilot but the store still exists for legacy projects.
  part5: {
    // Slide H1 mirrors the sidebar label from `sidebar.parts[4]`
    // (curriculum-team copy, 2026-05).
    slideTitle: 'Creative Demonstration',
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
    generate: 'Generate AI Feedback',
    regenerate: 'Regenerate Feedback',
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
    stylesHint: 'Tell ArtBloom about your lesson in the chat panel → style options will appear here.',
    convertBtn: 'Converting!',
    allUsed: 'All styles have been used. Upload a new work to try again.',
    convertingOverlay: 'Converting...',
    convertAgain: 'Convert again',
    save: 'Save',
    saveNext: 'Save & Next',
    bot: {
      greeting: "Hi! I'm ArtBloom. Upload a student sketch in Step 1, then tell me about your lesson theme or learning objective — I'll generate 3 personalised style transfer options for you.",
      sketchUploaded: "Sketch uploaded! Now describe your lesson context and I'll generate the style options. For example: \"Students are learning to exaggerate proportions in animal drawings.\"",
      stylesReady: 'Here are 3 style transfer options based on your lesson:',
      stylesReadySuffix: 'Here are the 3 recommended style options:',
      selectedStyleLabel: 'Selected style prompt:',
      selectedStyleNote: "Please review the style prompts for each option. If you'd like any adjustments, just let me know.",
      errorStyles: "Sorry, I couldn't generate style options:",
      errorChat: 'Sorry, something went wrong. Please try again.',
    },
  },
}
