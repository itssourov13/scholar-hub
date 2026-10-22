/**
 * Bilingual strings for the mobile app. Values are taken verbatim from the web
 * app's copy (apps/web/src/lib/translations.ts) wherever an equivalent exists,
 * so the two clients read identically. A few mobile-only functional strings are
 * faithful translations in the same voice. Note: the brand is always written
 * "ScholarHub" — never transliterated — matching the web.
 */
export type Lang = "en" | "bn";

export const translations = {
  // ── Common ──
  "app.name": { en: "ScholarHub", bn: "ScholarHub" },
  "common.retry": { en: "Try again", bn: "আবার চেষ্টা করুন" },
  "common.cancel": { en: "Cancel", bn: "বাতিল করুন" },
  "common.close": { en: "Close", bn: "বন্ধ" },
  "common.featured": { en: "Featured", bn: "Featured" },

  // ── Tabs ──
  "tab.home": { en: "Home", bn: "হোম" },
  "tab.discover": { en: "Scholarships", bn: "স্কলারশিপ" },
  "tab.guides": { en: "Guides", bn: "গাইড" },
  "tab.mentor": { en: "Mentor", bn: "মেন্টর" },
  "tab.profile": { en: "Profile", bn: "প্রোফাইল" },

  // ── Auth (from login.* / signup.*) ──
  "auth.welcomeBack": { en: "Welcome back", bn: "স্বাগতম" },
  "auth.signInSubtitle": {
    en: "Sign in to continue to your account",
    bn: "আপনার একাউন্টে প্রবেশ করতে সাইন ইন করুন",
  },
  "auth.email": { en: "Email", bn: "Email" },
  "auth.password": { en: "Password", bn: "Password" },
  "auth.showPassword": { en: "Show password", bn: "পাসওয়ার্ড দেখান" },
  "auth.hidePassword": { en: "Hide password", bn: "পাসওয়ার্ড লুকান" },
  "auth.signIn": { en: "Sign in", bn: "সাইন ইন" },
  "auth.signInFailed": {
    en: "Sign in failed. Check your email and password.",
    bn: "সাইন ইন ব্যর্থ। আপনার Email ও Password যাচাই করুন।",
  },
  "auth.noAccount": { en: "Don't have an account? ", bn: "একাউন্ট নেই? " },
  "auth.signUp": { en: "Create one", bn: "তৈরি করুন" },
  "auth.createAccount": { en: "Create your account", bn: "আপনার একাউন্ট তৈরি করুন" },
  "auth.createAccountButton": { en: "Create account", bn: "একাউন্ট তৈরি করুন" },
  "auth.haveAccount": { en: "Already have an account? ", bn: "ইতিমধ্যে একাউন্ট আছে? " },
  "auth.continue": { en: "Create account", bn: "একাউন্ট তৈরি করুন" },
  "auth.orDivider": { en: "or", bn: "অথবা" },
  "auth.google": { en: "Continue with Google", bn: "Google দিয়ে চালিয়ে যান" },
  "auth.verifyPrompt": { en: "We sent a 6-digit code to", bn: "আমরা একটি ৬-সংখ্যার কোড পাঠিয়েছি" },
  "auth.verifyCode": { en: "Verification code", bn: "ভেরিফিকেশন কোড" },
  "auth.verify": { en: "Verify & create account", bn: "ভেরিফাই করে একাউন্ট তৈরি করুন" },
  "auth.signUpFailed": {
    en: "Sign up failed. Try a different email.",
    bn: "সাইন আপ ব্যর্থ। অন্য Email চেষ্টা করুন।",
  },
  "auth.twoFactorUnsupported": {
    en: "This account uses two-factor authentication, which the app doesn't support yet. Sign in with Google, or disable 2FA on the web.",
    bn: "এই একাউন্টে টু-ফ্যাক্টর অথেন্টিকেশন আছে, যা app-এ এখনো সমর্থিত নয়। Google দিয়ে সাইন ইন করুন, অথবা ওয়েবে 2FA বন্ধ করুন।",
  },

  // ── Home (from home.* hero) ──
  "home.kicker": {
    en: "AI scholarship compass for Bangladesh",
    bn: "বাংলাদেশের শিক্ষার্থীদের জন্য AI ভিত্তিক স্কলারশিপ প্ল্যাটফর্ম",
  },
  "home.welcomeTitle": {
    en: "Find scholarships that fit your story, not just your grades.",
    bn: "এমন স্কলারশিপ খুঁজুন যা আপনার গল্পের সাথে মানানসই, CGPA এর সাথে নয়।",
  },
  "home.welcomeSubtitle": {
    en: "ScholarHub guides students through higher-study decisions with explainable AI, localized advice, and a curated scholarship map.",
    bn: "ScholarHub — এর Advanced AI Model সমৃদ্ধ AI Mentor, Expert দের গাইডলাইন আর curated scholarship তোমার Higher Study র যাত্রা কে করবে সহজ।",
  },
  "home.exploreTitle": { en: "Browse all scholarships", bn: "সব scholarship দেখুন" },
  "home.exploreSubtitle": { en: "scholarships across 30+ countries", bn: "৩০+ দেশের scholarships" },
  "home.mentorTitle": { en: "Ask ScholarHub Mentor", bn: "ScholarHub Mentor-কে জিজ্ঞেস করুন" },
  "home.mentorSubtitle": { en: "AI guidance", bn: "AI সহায়তা" },

  // ── Discover / Scholarships (from scholarships.*) ──
  "discover.loadError": { en: "Couldn't load scholarships.", bn: "Scholarship লোড করা যায়নি।" },
  "discover.empty": {
    en: "No scholarships match those filters yet.",
    bn: "এই filter-এ কোনো scholarship পাওয়া যাচ্ছে না।",
  },
  "discover.filters": { en: "Filters", bn: "ফিল্টার" },
  "discover.filterCountry": { en: "Country", bn: "দেশ" },
  "discover.filterDegree": { en: "Level", bn: "Level" },
  "discover.filterFunding": { en: "Funding", bn: "Funding" },
  "discover.apply": { en: "Show results", bn: "ফলাফল দেখুন" },
  "discover.clear": { en: "Clear", bn: "মুছুন" },
  "discover.resultsCount": { en: "scholarships", bn: "scholarship" },

  // ── Scholarship detail ──
  "detail.about": { en: "About", bn: "সম্পর্কে" },
  "detail.eligibility": { en: "Eligibility", bn: "যোগ্যতা" },
  "detail.benefits": { en: "Benefits", bn: "সুবিধা" },
  "detail.requiredDocuments": { en: "Required documents", bn: "প্রয়োজনীয় ডকুমেন্ট" },
  "detail.coreDocuments": { en: "Essential", bn: "অপরিহার্য" },
  "detail.additionalDocuments": { en: "Sometimes required", bn: "কখনো কখনো প্রয়োজন" },
  "detail.generateDocs": { en: "Show document checklist", bn: "ডকুমেন্ট চেকলিস্ট দেখুন" },
  "detail.docsError": { en: "Couldn't load documents.", bn: "ডকুমেন্ট লোড করা যায়নি।" },
  "detail.applyNow": { en: "Apply on official site", bn: "অফিসিয়াল সাইটে আবেদন করুন" },
  "detail.notFound": { en: "Scholarship not found.", bn: "Scholarship পাওয়া যায়নি।" },

  // ── Chat (from chat.*) ──
  "chat.placeholder": { en: "Ask anything…", bn: "যেকোনো কিছু জিজ্ঞেস করুন…" },
  "chat.disclaimer": {
    en: "AI Mentor can make mistakes — verify deadlines and requirements on official sites.",
    bn: "AI মেন্টর ভুল করতে পারে — ডেডলাইন ও শর্ত অফিসিয়াল সাইটে যাচাই করুন।",
  },
  "chat.emptyHint": {
    en: "Ask about scholarships, IELTS, SOP writing, and more.",
    bn: "Scholarship, IELTS, SOP writing ও আরো নিয়ে জিজ্ঞেস করুন।",
  },
  "chat.error": { en: "Something went wrong. Please try again.", bn: "কিছু ভুল হয়েছে। আবার চেষ্টা করুন।" },
  "chat.history": { en: "History", bn: "ইতিহাস" },
  "chat.newChat": { en: "New chat", bn: "নতুন Chat" },
  "chat.noSessions": { en: "No past conversations yet.", bn: "এখনো কোনো পুরনো কথোপকথন নেই।" },
  "chat.delete": { en: "Delete", bn: "মুছুন" },

  // ── Profile (from profile.* / dashboard.*) ──
  "profile.signedIn": { en: "Signed in", bn: "সাইন ইন করা আছে" },
  "profile.authChecking": { en: "Connecting…", bn: "সংযোগ হচ্ছে…" },
  "profile.authOk": { en: "Your account is connected.", bn: "আপনার একাউন্ট সংযুক্ত।" },
  "profile.authFail": { en: "Connection problem", bn: "সংযোগ সমস্যা" },
  "profile.noProfile": {
    en: "Complete your profile on the web to see it here.",
    bn: "এখানে দেখতে ওয়েবে আপনার profile সম্পূর্ণ করুন।",
  },
  "profile.name": { en: "Full name", bn: "পূর্ণ নাম" },
  "profile.university": { en: "University", bn: "University" },
  "profile.targetDegree": { en: "Target degree", bn: "Target Degree" },
  "profile.cgpa": { en: "CGPA", bn: "CGPA" },
  "profile.ielts": { en: "IELTS / TOEFL", bn: "IELTS / TOEFL" },
  "profile.language": { en: "Language", bn: "ভাষা" },
  "profile.signOut": { en: "Sign out", bn: "সাইন আউট" },
  "profile.privacy": { en: "Privacy policy", bn: "গোপনীয়তা নীতি" },
  "profile.terms": { en: "Terms of service", bn: "ব্যবহারের শর্তাবলী" },
  "profile.deleteAccount": { en: "Delete account", bn: "অ্যাকাউন্ট মুছে ফেলুন" },
  "profile.deleteTitle": { en: "Delete your account?", bn: "অ্যাকাউন্ট মুছে ফেলবেন?" },
  "profile.deleteBody": {
    en: "This permanently deletes your account, profile, bookmarks, CVs and chat history. This cannot be undone.",
    bn: "এতে আপনার অ্যাকাউন্ট, প্রোফাইল, বুকমার্ক, CV ও চ্যাট ইতিহাস স্থায়ীভাবে মুছে যাবে। এটি আর ফেরানো যাবে না।",
  },
  "profile.deleteFailed": {
    en: "Couldn't delete your account. Please try again.",
    bn: "অ্যাকাউন্ট মুছে ফেলা যায়নি। আবার চেষ্টা করুন।",
  },

  // ── Redesign: shared ──
  "common.seeAll": { en: "See all", bn: "সব দেখুন" },

  // ── Redesign: Sign-in ──
  "auth.tagline": { en: "Scholarships Made Simple", bn: "Scholarships Made Simple" },
  "auth.heroTitle": {
    en: "Find scholarships that fit your story.",
    bn: "তোমার গল্পের সাথে মানানসই scholarship খুঁজে নাও।",
  },
  "auth.heroSub": {
    en: "Explainable AI, localized advice, and a curated scholarship map — built for Bangladeshi students.",
    bn: "Explainable AI, লোকাল গাইডলাইন আর curated scholarship map — বাংলাদেশি শিক্ষার্থীদের জন্য।",
  },

  // ── Redesign: Home ──
  "home.hello": { en: "Hello", bn: "স্বাগতম" },
  "home.heroKicker": { en: "AI Scholarship Compass", bn: "AI স্কলারশিপ কম্পাস" },
  "home.exploreBtn": { en: "Browse scholarships", bn: "সব scholarship দেখুন" },
  "home.qaScholar": { en: "Scholarships", bn: "স্কলারশিপ" },
  "home.qaScholarSub": { en: "30+ countries", bn: "৩০+ দেশ" },
  "home.qaCV": { en: "CV Builder", bn: "CV Builder" },
  "home.qaCVSub": { en: "Print-ready PDF", bn: "Print-ready PDF" },
  "home.yourProfile": { en: "Your profile", bn: "আপনার প্রোফাইল" },
  "home.stillMissing": { en: "Still missing:", bn: "এখনো বাকি:" },
  "home.forYou": { en: "For you", bn: "তোমার জন্য" },
  "home.mentorTag": { en: "AI Mentor", bn: "AI মেন্টর" },
  "home.mentorTeaser": {
    en: "Not a generic chatbot. It knows Bangladeshi context, CGPA & IELTS.",
    bn: "সাধারণ চ্যাটবট নয়। বাংলাদেশি প্রেক্ষাপট, CGPA ও IELTS জানে।",
  },
  "home.tryMentor": { en: "Ask anything", bn: "যেকোনো কিছু জিজ্ঞেস করুন" },

  // ── Redesign: Scholarships ──
  "discover.title": { en: "Scholarships", bn: "স্কলারশিপ" },
  "discover.searchPh": { en: "Search scholarships…", bn: "Scholarship খুঁজুন…" },
  "discover.openNow": { en: "Open Now", bn: "এখন খোলা" },
  "discover.recentlyClosed": { en: "Recently Closed", bn: "সম্প্রতি বন্ধ" },
  "discover.openingSoon": { en: "Opening Soon", bn: "শীঘ্রই খুলছে" },
  "cv.stageRead": { en: "Reading your CV", bn: "আপনার সিভি পড়া হচ্ছে" },
  "cv.stageReadHint": { en: "Extracting text from the file…", bn: "ফাইল থেকে টেক্সট বের করা হচ্ছে…" },
  "cv.stageSections": { en: "Detecting sections", bn: "সেকশন শনাক্ত করা হচ্ছে" },
  "cv.stageSectionsHint": { en: "Education, research, awards, publications…", bn: "শিক্ষা, গবেষণা, পুরস্কার, প্রকাশনা…" },
  "cv.stageStructure": { en: "Evaluating structure", bn: "কাঠামো মূল্যায়ন করা হচ্ছে" },
  "cv.stageStructureHint": { en: "Layout, length, and how reviewers read it.", bn: "লেআউট, দৈর্ঘ্য ও পাঠযোগ্যতা।" },
  "cv.stageStrengths": { en: "Finding strengths & gaps", bn: "শক্তি ও ঘাটতি খোঁজা হচ্ছে" },
  "cv.stageStrengthsHint": { en: "What works, and what's missing.", bn: "কোনটা ভালো আছে, কোনটা নেই।" },
  "cv.stageReport": { en: "Writing your report", bn: "রিপোর্ট তৈরি হচ্ছে" },
  "cv.stageReportHint": { en: "Concrete suggestions and an action plan.", bn: "সুনির্দিষ্ট পরামর্শ ও করণীয় তালিকা।" },
  "discover.opensPrefix": { en: "Opens:", bn: "খুলবে:" },
  "discover.closed": { en: "Closed", bn: "বন্ধ" },
  "discover.tracked": { en: "Tracked", bn: "ট্র্যাক করা" },
  "discover.openSuffix": { en: "open now", bn: "এখন খোলা" },
  "discover.showResults": { en: "Show results", bn: "ফলাফল দেখুন" },

  // ── Redesign: Detail ──
  "detail.deadlineLabel": { en: "Deadline", bn: "ডেডলাইন" },
  "detail.rolling": { en: "Open all year", bn: "সারা বছর খোলা" },

  // ── Redesign: Chat ──
  "chat.mentorName": { en: "ScholarHub Mentor", bn: "ScholarHub Mentor" },
  "chat.ready": { en: "Ready", bn: "প্রস্তুত" },
  // Staged "working on it" labels shown while the reply streams in. Kept generic
  // on purpose — the same sequence has to fit any question the user might ask.
  "chat.think1": { en: "Reading your question…", bn: "তোমার প্রশ্ন পড়ছি…" },
  "chat.think2": { en: "Looking things up…", bn: "তথ্য খুঁজে দেখছি…" },
  "chat.think3": { en: "Going through the details…", bn: "খুঁটিনাটি দেখে নিচ্ছি…" },
  "chat.think4": { en: "Thinking it through…", bn: "ভেবে দেখছি…" },
  "chat.think5": { en: "Writing your answer…", bn: "উত্তর লিখছি…" },
  "chat.think6": { en: "Almost there…", bn: "প্রায় হয়ে এসেছে…" },
  "chat.greeting": {
    en: "Hi! I'm your ScholarHub Mentor. I can help you find scholarships, check eligibility, and build an application strategy. What program are you aiming for?",
    bn: "হাই! আমি তোমার ScholarHub মেন্টর। scholarship খুঁজে দেওয়া, যোগ্যতা যাচাই আর application strategy তৈরিতে সাহায্য করতে পারি। কোন প্রোগ্রামের জন্য প্রস্তুতি নিচ্ছো?",
  },
  "chat.suggest1": { en: "Scholarships closing in 60 days", bn: "৬০ দিনে বন্ধ হওয়া scholarship দেখাও" },
  "chat.suggest2": { en: "Do I need IELTS for Germany?", bn: "জার্মানিতে IELTS লাগবে?" },
  "chat.suggest3": { en: "Summarize DAAD EPOS requirements", bn: "DAAD EPOS-এর শর্ত সংক্ষেপে বলো" },
  "chat.suggest4": { en: "Create a 90-day prep plan", bn: "৯০ দিনের প্রস্তুতি প্ল্যান দাও" },
  "chat.attach": { en: "Add a document", bn: "ডকুমেন্ট যোগ করুন" },
  "chat.attachTitle": { en: "What should the mentor look at?", bn: "মেন্টর কী দেখবে?" },
  "chat.attachSheetSub": {
    en: "One document with this message, max 1 MB. You can always keep typing questions.",
    bn: "এই মেসেজে একটি ডকুমেন্ট, সর্বোচ্চ ১ MB। প্রশ্ন টাইপ করা সবসময় খোলা থাকবে।",
  },
  "chat.attachCv": { en: "My CV / resume", bn: "আমার CV / resume" },
  "chat.attachCvHint": { en: "PDF — strengths, gaps, what to fix first", bn: "PDF — শক্তি, ঘাটতি, আগে কী ঠিক করব" },
  "chat.attachTranscript": { en: "Transcript / marksheet", bn: "ট্রান্সক্রিপ্ট / মার্কশিট" },
  "chat.attachTranscriptHint": { en: "PDF or photo — grades and eligibility", bn: "PDF বা ছবি — গ্রেড ও যোগ্যতা" },
  "chat.attachLetter": { en: "Offer or scholarship letter", bn: "অফার বা scholarship লেটার" },
  "chat.attachLetterHint": { en: "PDF or photo — deadline, funding, conditions", bn: "PDF বা ছবি — ডেডলাইন, ফান্ডিং, শর্ত" },
  "chat.attachShot": { en: "Deadline or requirement screenshot", bn: "ডেডলাইন বা শর্তের স্ক্রিনশট" },
  "chat.attachShotHint": { en: "A page from a portal or email", bn: "পোর্টাল বা ইমেইলের একটি পাতা" },
  "chat.attachPromptCv": {
    en: "Please review this CV for scholarship and master's applications. What should I fix first?",
    bn: "Scholarship ও master's application-এর জন্য এই CV-টা দেখো। আগে কী ঠিক করা উচিত?",
  },
  "chat.attachPromptTranscript": {
    en: "Please read this transcript or marksheet. Summarise my grades and flag anything that matters for scholarship eligibility.",
    bn: "এই ট্রান্সক্রিপ্ট বা মার্কশিট পড়ো। গ্রেড সারসংক্ষেপ করো, scholarship যোগ্যতার জন্য যা জরুরি তা বলে দাও।",
  },
  "chat.attachPromptLetter": {
    en: "Please read this offer or scholarship letter. Extract the deadline, funding, conditions, and what I should do next.",
    bn: "এই অফার বা scholarship লেটার পড়ো। ডেডলাইন, ফান্ডিং, শর্ত আর আমার পরের কাজটা বের করে দাও।",
  },
  "chat.attachPromptShot": {
    en: "Please read this screenshot. Quote any deadline, requirement, or figure exactly as written.",
    bn: "এই স্ক্রিনশট পড়ো। যে ডেডলাইন, শর্ত বা সংখ্যা আছে হুবহু লিখে দাও।",
  },
  "chat.attachHint": {
    en: "1 document per message, max 1 MB. 2 document readings per day — typing is unlimited.",
    bn: "প্রতি মেসেজে ১টি ডকুমেন্ট, সর্বোচ্চ ১ MB। দিনে ২বার পড়া যাবে — টাইপ করা সীমাহীন।",
  },
  "chat.attachTooLarge": {
    en: "That file is too large (max 1 MB). Try a clearer screenshot or a smaller PDF.",
    bn: "ফাইলটি বড় (সর্বোচ্চ ১ MB)। পরিষ্কার স্ক্রিনশট বা ছোট PDF চেষ্টা করুন।",
  },
  "chat.attachTooMany": { en: "One document per message — remove this one first, or it will be replaced.", bn: "প্রতি মেসেজে একটি ডকুমেন্ট — আগে এটি সরান, নইলে নতুনটি বসবে।" },
  "chat.attachUnsupported": {
    en: "Use a photo (JPEG, PNG, WebP) or a PDF.",
    bn: "ছবি (JPEG, PNG, WebP) অথবা PDF ব্যবহার করুন।",
  },
  "chat.attachUnreadable": {
    en: "Couldn't read that file. Try another one.",
    bn: "ফাইলটি পড়া যায়নি। অন্যটি চেষ্টা করুন।",
  },
  "chat.attachSignIn": {
    en: "Sign in to send a document. You can keep typing questions.",
    bn: "ডকুমেন্ট পাঠাতে সাইন ইন করুন। প্রশ্ন টাইপ করা যাবে।",
  },
  "chat.attachLimitDaily": {
    en: "You can keep typing — only document reading is limited (2 per day).",
    bn: "টাইপ করা যাবে — শুধু ডকুমেন্ট পড়া সীমিত (দিনে ২টি)।",
  },
  "chat.attachLimitHourly": {
    en: "You can keep typing — document reading is paused for a bit (2 per hour).",
    bn: "টাইপ করা যাবে — ডকুমেন্ট পড়া কিছুক্ষণ বন্ধ (ঘণ্টায় ২টি)।",
  },
  "chat.attachLimitGlobal": {
    en: "You can keep typing — document reading is paused today so the free mentor can stay online.",
    bn: "টাইপ করা যাবে — ফ্রি মেন্টর চালু রাখতে আজ ডকুমেন্ট পড়া বন্ধ আছে।",
  },
  "chat.attachLimitReset": { en: "Resets in", bn: "আবার খুলবে" },

  // ── Redesign: Guides ──
  "guides.knowledgeHub": { en: "Knowledge Hub", bn: "নলেজ হাব" },
  "guides.title": { en: "Study Abroad Guides", bn: "Study Abroad গাইড" },
  "guides.subtitle": {
    en: "Expert answers to the questions Bangladeshi students ask most.",
    bn: "বাংলাদেশি শিক্ষার্থীদের সবচেয়ে বেশি জিজ্ঞাসিত প্রশ্নের বিশেষজ্ঞ উত্তর।",
  },
  "guides.readMore": { en: "Read", bn: "পড়ুন" },
  "guides.faqs": { en: "FAQs", bn: "FAQ" },
  "guides.askTitle": { en: "Still have questions?", bn: "এখনো প্রশ্ন আছে?" },
  "guides.askSub": {
    en: "Every student's situation is unique. Get personalised answers in seconds.",
    bn: "প্রতিটি শিক্ষার্থীর অবস্থা আলাদা। কয়েক সেকেন্ডে ব্যক্তিগত উত্তর পান।",
  },
  "guides.talkMentor": { en: "Talk to the Mentor", bn: "মেন্টরের সাথে কথা বলুন" },
  "guides.loadError": { en: "Couldn't load guides.", bn: "গাইড লোড করা যায়নি।" },

  // ── Redesign: CV Builder ──
  "cv.title": { en: "CV Builder", bn: "CV Builder" },
  "cv.heroA": { en: "An academic CV that", bn: "এমন একাডেমিক CV যা" },
  "cv.heroB": { en: "opens doors.", bn: "দরজা খুলে দেয়।" },
  "cv.heroSub": {
    en: "Start from a proven template — or let our AI review your current CV. Export a print-ready PDF in one tap.",
    bn: "প্রমাণিত template থেকে শুরু করুন — অথবা AI দিয়ে আপনার CV রিভিউ করান। এক ট্যাপে print-ready PDF।",
  },
  "cv.create": { en: "Create new CV", bn: "নতুন CV তৈরি করুন" },
  "cv.createSub": { en: "Guided form · live preview", bn: "গাইডেড ফর্ম · লাইভ প্রিভিউ" },
  "cv.analyze": { en: "Analyze my current CV", bn: "আমার CV বিশ্লেষণ করুন" },
  "cv.analyzeSub": { en: "AI feedback in seconds", bn: "কয়েক সেকেন্ডে AI ফিডব্যাক" },
  "cv.templates": { en: "Choose a template", bn: "একটি template বাছুন" },
  "cv.openOnWeb": { en: "Continue on the web", bn: "ওয়েবে চালিয়ে যান" },

  // ── Redesign: Notifications (derived from dashboard) ──
  "notif.title": { en: "Notifications", bn: "নোটিফিকেশন" },
  "notif.empty": { en: "You're all caught up.", bn: "সব দেখা হয়ে গেছে।" },
  "notif.deadlineTitle": { en: "Deadline soon", bn: "ডেডলাইন কাছে" },
  "notif.newSchTitle": { en: "New scholarships added", bn: "নতুন scholarship যোগ হয়েছে" },
  "notif.newSchBody": {
    en: "Fresh matches might fit your profile — worth a quick look.",
    bn: "তোমার প্রোফাইলের সাথে মিলতে পারে — এক নজর দেখো।",
  },
  "notif.mentorTitle": { en: "New reply from Mentor", bn: "মেন্টরের নতুন উত্তর" },
  "notif.profileTitle": { en: "Complete your profile", bn: "প্রোফাইল সম্পূর্ণ করুন" },
  "notif.profileBody": {
    en: "Add the missing details to unlock better matches.",
    bn: "আরও ভালো ম্যাচের জন্য বাকি তথ্য যোগ করুন।",
  },

  // ── Device push (background content check) ──
  "push.newScholarship": { en: "New scholarship 🎓", bn: "নতুন স্কলারশিপ 🎓" },
  "push.newScholarships": { en: "New scholarships 🎓", bn: "নতুন স্কলারশিপ 🎓" },
  "push.newScholarshipsBody": {
    en: "new scholarships were just added — tap to browse.",
    bn: "টি নতুন স্কলারশিপ যোগ হয়েছে — দেখতে ট্যাপ করুন।",
  },
  "push.newGuide": { en: "New guide 📖", bn: "নতুন গাইড 📖" },
  "push.newGuides": { en: "New guides 📖", bn: "নতুন গাইড 📖" },
  "push.newGuidesBody": {
    en: "new guides were just published — tap to read.",
    bn: "টি নতুন গাইড প্রকাশিত হয়েছে — পড়তে ট্যাপ করুন।",
  },

  // ── Redesign: Profile hub ──
  "profile.complete": { en: "Profile completeness", bn: "প্রোফাইল সম্পূর্ণতা" },
  "profile.saved": { en: "Saved", bn: "সংরক্ষিত" },
  "profile.cvDrafts": { en: "CV drafts", bn: "CV ড্রাফট" },
  "profile.myBookmarks": { en: "My bookmarks", bn: "আমার বুকমার্ক" },
  "profile.myCVs": { en: "My CVs", bn: "আমার CV" },
  "profile.settings": { en: "Settings", bn: "সেটিংস" },
  "profile.notifications": { en: "Notifications", bn: "নোটিফিকেশন" },
  "profile.rateApp": { en: "Rate this app", bn: "অ্যাপটি রেট করুন" },
  "profile.rateAppFailed": {
    en: "Couldn't open the Play Store. Search for ScholarHub there to leave a rating.",
    bn: "Play Store খোলা যায়নি। রেটিং দিতে সেখানে ScholarHub খুঁজুন।",
  },

  // ── Redesign: Bookmarks ──
  "bookmarks.title": { en: "My bookmarks", bn: "আমার বুকমার্ক" },
  "bookmarks.emptyTitle": { en: "No bookmarks yet", bn: "এখনো কোনো বুকমার্ক নেই" },
  "bookmarks.emptyBody": {
    en: "Tap the bookmark icon on any scholarship to save it here.",
    bn: "যেকোনো scholarship-এর বুকমার্ক আইকনে ট্যাপ করে এখানে সেভ করুন।",
  },
  "bookmarks.browse": { en: "Browse scholarships", bn: "Scholarship দেখুন" },

  // ── Guide detail ──
  "guide.updated": { en: "Updated", bn: "আপডেট" },
  "guide.faqTitle": { en: "Frequently asked", bn: "সচরাচর জিজ্ঞাসা" },
  "guide.related": { en: "Related guides", bn: "সম্পর্কিত গাইড" },
  "guide.askMentor": { en: "Ask the AI Mentor", bn: "AI মেন্টরকে জিজ্ঞেস করুন" },
  "guide.askMentorSub": {
    en: "Have a more specific question? Get a personalised answer in seconds.",
    bn: "আরও নির্দিষ্ট প্রশ্ন আছে? কয়েক সেকেন্ডে ব্যক্তিগত উত্তর পান।",
  },
  "guide.notFound": { en: "Guide not found.", bn: "গাইড পাওয়া যায়নি।" },
  "common.save": { en: "Save", bn: "সংরক্ষণ করুন" },
  "common.delete": { en: "Delete", bn: "মুছুন" },
  "common.optional": { en: "optional", bn: "ঐচ্ছিক" },

  // ── Profile edit ──
  "profile.edit": { en: "Edit profile", bn: "প্রোফাইল সম্পাদনা" },
  "profile.savedToast": { en: "Profile saved", bn: "প্রোফাইল সংরক্ষিত হয়েছে" },
  "profile.saveError": { en: "Couldn't save. Try again.", bn: "সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।" },
  "profile.loadError": {
    en: "Couldn't load your profile. Try again.",
    bn: "প্রোফাইল লোড করা যায়নি। আবার চেষ্টা করুন।",
  },
  "profile.sectionBasics": { en: "Basics", bn: "মূল তথ্য" },
  "profile.sectionAcademics": { en: "Academics", bn: "একাডেমিক" },
  "profile.sectionGoals": { en: "Goals & research", bn: "লক্ষ্য ও গবেষণা" },
  "profile.major": { en: "Major / department", bn: "বিভাগ" },
  "profile.gradYear": { en: "Graduation year", bn: "স্নাতক বর্ষ" },
  "profile.preferredCountries": { en: "Preferred countries", bn: "পছন্দের দেশ" },
  "profile.targetDegreeLevel": { en: "Target degree level", bn: "টার্গেট ডিগ্রি" },
  "profile.researchInterests": { en: "Research interests", bn: "গবেষণার আগ্রহ" },
  "profile.workExperience": { en: "Work experience", bn: "কর্ম অভিজ্ঞতা" },
  "profile.goals": { en: "Goals & notes", bn: "লক্ষ্য ও নোট" },
  "profile.greGmat": { en: "GRE / GMAT", bn: "GRE / GMAT" },
  "profile.internships": { en: "Internships", bn: "ইন্টার্নশিপ" },
  "profile.publishedPapers": { en: "Published papers", bn: "প্রকাশিত পেপার" },
  "profile.portfolio": { en: "Portfolio URL", bn: "পোর্টফোলিও URL" },

  // ── CV builder ──
  "cv.myList": { en: "My CVs", bn: "আমার CV" },
  "cv.newBlank": { en: "New CV", bn: "নতুন CV" },
  "cv.emptyList": { en: "No CVs yet — create one to get started.", bn: "এখনো কোনো CV নেই — একটি তৈরি করুন।" },
  "cv.creating": { en: "Creating…", bn: "তৈরি হচ্ছে…" },
  "cv.saved": { en: "CV saved", bn: "CV সংরক্ষিত হয়েছে" },
  "cv.deleteConfirm": { en: "Delete this CV?", bn: "এই CV মুছবেন?" },
  "cv.untitled": { en: "Untitled CV", bn: "শিরোনামহীন CV" },
  "cv.cvTitle": { en: "CV title", bn: "CV শিরোনাম" },
  "cv.template": { en: "Template", bn: "টেমপ্লেট" },
  "cv.advancedNote": {
    en: "Advanced sections, formatting & PDF export are available in the web builder.",
    bn: "উন্নত সেকশন, ফরম্যাটিং ও PDF এক্সপোর্ট ওয়েব বিল্ডারে পাওয়া যায়।",
  },
  "cv.openWeb": { en: "Open in web builder", bn: "ওয়েব বিল্ডারে খুলুন" },
  // editor field labels
  "cv.fullName": { en: "Full name", bn: "পূর্ণ নাম" },
  "cv.headline": { en: "Headline", bn: "হেডলাইন" },
  "cv.email": { en: "Email", bn: "Email" },
  "cv.phone": { en: "Phone", bn: "ফোন" },
  "cv.location": { en: "Location", bn: "অবস্থান" },
  "cv.website": { en: "Website", bn: "ওয়েবসাইট" },
  "cv.summary": { en: "Summary", bn: "সারসংক্ষেপ" },
  "cv.researchInterests": { en: "Research interests", bn: "গবেষণার আগ্রহ" },
  "cv.education": { en: "Education", bn: "শিক্ষা" },
  "cv.experience": { en: "Experience", bn: "অভিজ্ঞতা" },
  "cv.skills": { en: "Skills", bn: "দক্ষতা" },
  "cv.institution": { en: "Institution", bn: "প্রতিষ্ঠান" },
  "cv.degree": { en: "Degree", bn: "ডিগ্রি" },
  "cv.fieldOfStudy": { en: "Field of study", bn: "অধ্যয়নের বিষয়" },
  "cv.gpa": { en: "GPA / CGPA", bn: "GPA / CGPA" },
  "cv.role": { en: "Role / title", bn: "পদবি" },
  "cv.organization": { en: "Organization", bn: "প্রতিষ্ঠান" },
  "cv.startDate": { en: "Start", bn: "শুরু" },
  "cv.endDate": { en: "End", bn: "শেষ" },
  "cv.description": { en: "Description", bn: "বিবরণ" },
  "cv.skillCategory": { en: "Category", bn: "ক্যাটাগরি" },
  "cv.skillItems": { en: "Skills (comma-separated)", bn: "দক্ষতা (কমা দিয়ে আলাদা)" },
  "cv.addEducation": { en: "Add education", bn: "শিক্ষা যোগ করুন" },
  "cv.addExperience": { en: "Add experience", bn: "অভিজ্ঞতা যোগ করুন" },
  "cv.addSkill": { en: "Add skill group", bn: "দক্ষতা যোগ করুন" },
  "cv.cvNotFound": { en: "CV not found.", bn: "CV পাওয়া যায়নি।" },
  "cv.preview": { en: "Preview", bn: "প্রিভিউ" },
  "cv.edit": { en: "Edit", bn: "সম্পাদনা" },
  "cv.previewNote": {
    en: "This is a live preview. Export a polished, print-ready PDF from the web builder.",
    bn: "এটি একটি লাইভ প্রিভিউ। ওয়েব বিল্ডার থেকে print-ready PDF এক্সপোর্ট করুন।",
  },
  // analyze
  "cv.analyzeTitle": { en: "Analyze my CV", bn: "আমার CV বিশ্লেষণ" },
  "cv.analyzeIntro": {
    en: "Upload your current CV (PDF, DOCX, or TXT) or paste the text — the AI gives structured, actionable feedback.",
    bn: "আপনার বর্তমান CV (PDF, DOCX বা TXT) আপলোড করুন বা টেক্সট পেস্ট করুন — AI কাঠামোবদ্ধ, কার্যকর ফিডব্যাক দেবে।",
  },
  "cv.pickFile": { en: "Upload a file", bn: "ফাইল আপলোড করুন" },
  "cv.pasteInstead": { en: "Or paste CV text", bn: "অথবা CV টেক্সট পেস্ট করুন" },
  "cv.pastePlaceholder": { en: "Paste your CV text here…", bn: "এখানে আপনার CV টেক্সট পেস্ট করুন…" },
  "cv.analyzeBtn": { en: "Analyze", bn: "বিশ্লেষণ করুন" },
  "cv.analyzing": { en: "Analyzing your CV…", bn: "আপনার CV বিশ্লেষণ হচ্ছে…" },
  "cv.analyzeError": { en: "Couldn't analyze that. Try another file or paste the text.", bn: "বিশ্লেষণ করা যায়নি। অন্য ফাইল দিন বা টেক্সট পেস্ট করুন।" },
  "cv.overallScore": { en: "Overall score", bn: "সামগ্রিক স্কোর" },
  "cv.strengths": { en: "Strengths", bn: "শক্তি" },
  "cv.weaknesses": { en: "Weaknesses", bn: "দুর্বলতা" },
  "cv.actionItems": { en: "Action items", bn: "করণীয়" },
  "cv.missingSections": { en: "Missing sections", bn: "অনুপস্থিত সেকশন" },
  "cv.sectionBySection": { en: "Section by section", bn: "সেকশন অনুযায়ী" },
  "cv.analyzeAnother": { en: "Analyze another", bn: "আরেকটি বিশ্লেষণ" },
  "cv.buildBetter": { en: "Build a stronger CV", bn: "আরও ভালো CV তৈরি করুন" },

  // ── Roadmap ──
  "roadmap.title": { en: "My Roadmap", bn: "আমার রোডম্যাপ" },
  "roadmap.ready": { en: "ready", bn: "প্রস্তুত" },
  "roadmap.loading": { en: "Building your roadmap…", bn: "আপনার রোডম্যাপ তৈরি হচ্ছে…" },
  "roadmap.loadError": {
    en: "Couldn't load your roadmap. Check your connection and try again.",
    bn: "রোডম্যাপ লোড করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।",
  },
  "roadmap.setupTitle": { en: "Build your roadmap", bn: "আপনার রোডম্যাপ তৈরি করুন" },
  "roadmap.setupBody": {
    en: "Answer a few quick questions and we'll map your path.",
    bn: "কয়েকটি ছোট প্রশ্নের উত্তর দিন, আমরা আপনার পথ সাজিয়ে দেব।",
  },
  "roadmap.unlockScore": {
    en: "Add your degree and CGPA to see your readiness score.",
    bn: "আপনার degree আর CGPA যোগ করলে readiness স্কোর দেখা যাবে।",
  },
  "roadmap.unlockScoreField": {
    en: "Add {field} to see your readiness score.",
    bn: "readiness স্কোর দেখতে {field} যোগ করুন।",
  },
  "roadmap.unlockScoreCta": { en: "Add them now", bn: "এখনই যোগ করুন" },
  "roadmap.whyThisScore": { en: "Why this score", bn: "এই স্কোর কেন" },
  "roadmap.sharpen": { en: "Add {field} to sharpen this", bn: "আরও নিখুঁত করতে {field} যোগ করুন" },
  "roadmap.pointsOf": { en: "{earned} of {available}", bn: "{available}-এর মধ্যে {earned}" },
  "roadmap.notEnoughInfo": { en: "Not enough info yet", bn: "এখনও পর্যাপ্ত তথ্য নেই" },
  "roadmap.youAreHere": { en: "You are here", bn: "আপনি এখানে" },
  "roadmap.dueBy": { en: "Due {date}", bn: "{date} এর মধ্যে" },
  "roadmap.etaDays": { en: "About {n} days", bn: "প্রায় {n} দিন" },
  "roadmap.stageCount": { en: "{done} of {total} done", bn: "{total}-এর মধ্যে {done} শেষ" },
  "roadmap.mentorNext": { en: "Your next move", bn: "আপনার পরের ধাপ" },
  "roadmap.lift": { en: "{from}% → {to}%", bn: "{from}% → {to}%" },
  "roadmap.noLift": { en: "Add {evidence} to move your score", bn: "স্কোর বাড়াতে {evidence} যোগ করুন" },
  "roadmap.openStep": { en: "Open this step", bn: "ধাপটি খুলুন" },
  "roadmap.feasibleTight": {
    en: "This is tight, but still doable if you start now.",
    bn: "সময় কম, তবে এখনই শুরু করলে সম্ভব।",
  },
  "roadmap.feasibleNo": {
    en: "This cycle no longer fits. Target {term} {year} instead.",
    bn: "এই সাইকেলে আর হবে না। বরং {term} {year} লক্ষ্য করুন।",
  },
  "roadmap.detailWhy": { en: "Why this matters for you", bn: "আপনার জন্য এটি কেন জরুরি" },
  "roadmap.needsEvidence": {
    en: "Marking this done won't move your score until you add {evidence}.",
    bn: "{evidence} যোগ না করা পর্যন্ত এটি done করলেও স্কোর বাড়বে না।",
  },
  "roadmap.actionCv": { en: "Open CV Builder", bn: "CV Builder খুলুন" },
  "roadmap.actionDiscover": { en: "Browse scholarships", bn: "স্কলারশিপ দেখুন" },
  "roadmap.actionGuide": { en: "Read the guide", bn: "গাইড পড়ুন" },
  "roadmap.actionMentor": { en: "Ask the mentor", bn: "মেন্টরকে জিজ্ঞেস করুন" },
  "roadmap.actionForm": { en: "Update your profile", bn: "প্রোফাইল আপডেট করুন" },
  "roadmap.askMentor": { en: "Ask the mentor about this", bn: "এ নিয়ে মেন্টরকে জিজ্ঞেস করুন" },
  // Sent to the mentor automatically when a student asks about a step, so the
  // chat opens with a real answer instead of an empty box.
  "roadmap.mentorPrompt": {
    en: "I'm working on the “{title}” step of my study abroad roadmap. Why does this step matter for me, and what exactly should I do to complete it? Please give concrete steps for a student from Bangladesh.",
    bn: "আমি আমার স্টাডি অ্যাব্রোড রোডম্যাপের “{title}” ধাপটি নিয়ে কাজ করছি। এই ধাপটি আমার জন্য কেন গুরুত্বপূর্ণ, এবং এটি শেষ করতে আমাকে ঠিক কী কী করতে হবে? বাংলাদেশের একজন শিক্ষার্থীর জন্য বাস্তব ধাপগুলো বলুন।",
  },
  "roadmap.markDone": { en: "Mark as done", bn: "Done হিসেবে চিহ্নিত করুন" },
  "roadmap.markUndone": { en: "Mark as not done", bn: "আবার বাকি হিসেবে রাখুন" },
  "roadmap.saving": { en: "Saving…", bn: "সেভ হচ্ছে…" },
  "roadmap.notFound": { en: "That step isn't in your roadmap.", bn: "এই ধাপটি আপনার রোডম্যাপে নেই।" },
  "roadmap.backToRoadmap": { en: "Back to my roadmap", bn: "রোডম্যাপে ফিরুন" },
  // Stages
  "roadmap.stage.foundation": { en: "Foundation", bn: "ভিত্তি" },
  "roadmap.stage.testing": { en: "Testing", bn: "টেস্ট" },
  "roadmap.stage.documents": { en: "Documents", bn: "ডকুমেন্ট" },
  "roadmap.stage.applications": { en: "Applications", bn: "আবেদন" },
  "roadmap.stage.visa": { en: "Visa", bn: "ভিসা" },
  // Node states
  "roadmap.state.done": { en: "Done", bn: "সম্পন্ন" },
  "roadmap.state.active": { en: "In progress", bn: "চলছে" },
  "roadmap.state.locked": { en: "Locked", bn: "লক করা" },
  "roadmap.state.skipped": { en: "Skipped", bn: "বাদ দেওয়া" },
  // Pillars
  "roadmap.pillar.academics": { en: "Academics", bn: "একাডেমিক" },
  "roadmap.pillar.english": { en: "English", bn: "ইংরেজি" },
  "roadmap.pillar.documents": { en: "Documents", bn: "ডকুমেন্ট" },
  "roadmap.pillar.research": { en: "Research", bn: "গবেষণা" },
  "roadmap.pillar.experience": { en: "Experience", bn: "অভিজ্ঞতা" },
  "roadmap.pillar.application_progress": { en: "Applications", bn: "আবেদন" },
  // Input names, for the "add {field}" prompt
  "roadmap.input.degree": { en: "your target degree", bn: "আপনার target degree" },
  "roadmap.input.cgpa": { en: "your CGPA", bn: "আপনার CGPA" },
  "roadmap.input.english": { en: "your English test status", bn: "আপনার ইংরেজি টেস্টের অবস্থা" },
  "roadmap.input.docs": { en: "your documents", bn: "আপনার ডকুমেন্ট" },
  "roadmap.input.research": { en: "your publications", bn: "আপনার প্রকাশনা" },
  "roadmap.input.experience": { en: "your work experience", bn: "আপনার কাজের অভিজ্ঞতা" },
  "roadmap.input.target_country": { en: "your target country", bn: "আপনার লক্ষ্য দেশ" },
  "roadmap.input.intake": { en: "your intake", bn: "আপনার intake" },
  // Intake terms
  "roadmap.term.spring": { en: "Spring", bn: "Spring" },
  "roadmap.term.summer": { en: "Summer", bn: "Summer" },
  "roadmap.term.fall": { en: "Fall", bn: "Fall" },
  "roadmap.term.winter": { en: "Winter", bn: "Winter" },
  // English status options
  "roadmap.english.not_started": { en: "Haven't started yet", bn: "এখনও শুরু করিনি" },
  "roadmap.english.preparing": { en: "Preparing now", bn: "প্রস্তুতি নিচ্ছি" },
  "roadmap.english.booked": { en: "Test date booked", bn: "টেস্টের তারিখ নেওয়া আছে" },
  "roadmap.english.scored": { en: "I have my score", bn: "স্কোর হাতে আছে" },
  "roadmap.english.waived": { en: "Not required for me", bn: "আমার জন্য দরকার নেই" },
  // Documents
  "roadmap.doc.passport": { en: "Passport", bn: "পাসপোর্ট" },
  "roadmap.doc.transcripts": { en: "Transcripts", bn: "ট্রান্সক্রিপ্ট" },
  "roadmap.doc.sop": { en: "Statement of purpose", bn: "SOP" },
  "roadmap.doc.cv": { en: "Academic CV", bn: "একাডেমিক CV" },
  "roadmap.docStatus.missing": { en: "Not yet", bn: "এখনও নয়" },
  "roadmap.docStatus.in_progress": { en: "In progress", bn: "চলছে" },
  "roadmap.docStatus.ready": { en: "Ready", bn: "তৈরি" },
  // Wizard
  "roadmap.wizStep": { en: "Step {n} of 4", bn: "ধাপ {n} / ৪" },
  "roadmap.wizTitle1": { en: "What are you studying for?", bn: "আপনি কী পড়তে চান?" },
  "roadmap.wizTitle2": { en: "Where are you headed?", bn: "আপনি কোথায় যেতে চান?" },
  "roadmap.wizTitle3": { en: "Where are you with English?", bn: "ইংরেজি টেস্টের কী অবস্থা?" },
  "roadmap.wizTitle4": { en: "Which documents do you have?", bn: "কোন ডকুমেন্টগুলো আছে?" },
  "roadmap.degree.bachelor": { en: "Bachelor's", bn: "ব্যাচেলর" },
  "roadmap.degree.master": { en: "Master's", bn: "মাস্টার্স" },
  "roadmap.degree.phd": { en: "PhD", bn: "PhD" },
  "roadmap.wizCgpa": { en: "Your CGPA", bn: "আপনার CGPA" },
  "roadmap.wizCgpaPlaceholder": { en: "e.g. 3.65", bn: "যেমন ৩.৬৫" },
  "roadmap.wizCgpaHint": {
    en: "On a 4.0 or 5.0 scale. Leave it blank if you don't have it yet.",
    bn: "৪.০ বা ৫.০ স্কেলে। এখনও না থাকলে খালি রাখুন।",
  },
  "roadmap.wizCgpaInvalid": {
    en: "Enter your CGPA on a 4.0 or 5.0 scale — not a percentage.",
    bn: "CGPA ৪.০ বা ৫.০ স্কেলে লিখুন — শতকরা নয়।",
  },
  "roadmap.wizIntake": { en: "Which intake?", bn: "কোন intake?" },
  "roadmap.wizNext": { en: "Continue", bn: "চালিয়ে যান" },
  "roadmap.wizBack": { en: "Back", bn: "পিছনে" },
  "roadmap.wizFinish": { en: "Build my roadmap", bn: "রোডম্যাপ তৈরি করুন" },
  "roadmap.wizSaving": { en: "Building…", bn: "তৈরি হচ্ছে…" },
  "roadmap.wizRequired": { en: "Please choose an option to continue", bn: "চালিয়ে যেতে একটি অপশন বাছুন" },
  "roadmap.wizSaveFailed": {
    en: "Could not save your answers. Check your connection and try again.",
    bn: "উত্তরগুলো সেভ করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।",
  },
  // Home card
  "roadmap.qaTitle": { en: "My Roadmap", bn: "আমার রোডম্যাপ" },
  "roadmap.qaSub": { en: "Your next steps", bn: "আপনার পরের ধাপ" },
  "roadmap.nextUpShort": { en: "Next: {title}", bn: "পরে: {title}" },
} as const;

export type TranslationKey = keyof typeof translations;
