"use strict";
/* Antrag: the EU passenger-rights form, filled in from a ticket and sent by
   the visitor themselves. Everything personal stays in this page's memory:
   a PDF ticket is read here, the form is filled here, the packet is built
   here. The one exception is a photo of a ticket, which goes to the server's
   reader - and only after the visitor ticked the box that says so. Nothing
   is kept in storage, so closing the tab forgets it all. */
(function () {

const I18N = {
  de: {
    docTitle: "Entschädigung beantragen – DelayBahn",
    headerTitle: "Entschädigung beantragen",
    tagline: "Antrag ausfüllen, prüfen, selbst abschicken",
    navLogin: "Anmelden",
    trial: "Kostenlos in der Testphase",
    stopTicket: "Ticket",
    stopCosts: "Kosten",
    stopYou: "Deine Daten",
    stopReview: "Prüfen",
    stopSend: "Senden",
    next: "Weiter",
    back: "Zurück",
    feedbackAsk: "War dieser Schritt klar?",
    feedbackAskDone: "War der Antrag einfach?",
    feedbackYes: "Ja",
    feedbackNo: "Nein",
    feedbackDismiss: "Ausblenden",
    feedbackFollowUp: "Danke! Was können wir besser machen?",
    feedbackPlaceholder: "Was war hilfreich, was hat gefehlt oder gestört? Je konkreter, desto besser.",
    feedbackSend: "Senden",
    feedbackThanks: "Danke für dein Feedback.",
    close: "Schließen",
    formats: "PDF, JPG oder PNG",
    badFormat: "Dieses Dateiformat nimmt die Bahn nicht an. Bitte lade ein PDF, JPG oder PNG hoch.",
    tooBig: "Die Datei ist zu groß (höchstens 10 MB).",
    tripTitle: "Deine Fahrt",
    ticketTitle: "Dein Ticket",
    ticketFormats: "PDF, Screenshot oder Foto (JPG, PNG)",
    ticketRequired: "Die Deutsche Bahn verlangt das Ticket im Antrag.",
    ticketDrop: "Ticket hochladen oder hierher ziehen",
    ticketReading: "Lese das Ticket …",
    ticketRead: (name) => `Ticket gelesen: ${name}. Die Datei hat dein Gerät nicht verlassen.`,
    ticketPartial: "Wir konnten nicht alles lesen. Bitte ergänze die fehlenden Felder.",
    ticketFailed: "Das Ticket ließ sich nicht lesen. Du kannst die Felder selbst ausfüllen – das Ticket legen wir trotzdem bei.",
    editTitle: "Angaben korrigieren",
    lDay: "Reisetag",
    lPlan: "Laut Fahrplan",
    lTrains: "Züge",
    navLogout: "Abmelden",
    gateLead: "Einfach beantragen ist für Mitglieder kostenlos. Dafür bitten wir dich nur um ein kostenloses DelayBahn-Konto. Dein Antrag bleibt genau so, wie du ihn ausgefüllt hast.",
    lActual: "Tatsächlich angekommen",
    lTook: "Nächste realistische Verbindung",
    lMissed: "Anschluss verpasst in",
    lCancelled: "Ausgefallener Zug",
    vCancelled: "Zug ausgefallen",
    vCancelledFrom: (train, station) => `${train} ab ${station}`,
    lTicket: "Ticket",
    vActual: (day, time) => `${time} Uhr, ${day}`,
    vLate: (min) => `+${min} min`,
    needTicket: "Bitte lade dein Ticket hoch. Die Deutsche Bahn verlangt es im Antrag.",
    ticketNotDb: "Das sieht nicht nach einem Ticket der Deutschen Bahn aus. Bitte lade dein DB-Ticket hoch (PDF, JPG oder PNG).",
    ticketInvoice: "Das ist die Rechnung, nicht das Ticket. Bitte lade das Ticket selbst hoch.",
    photoLead: "Anthropics KI-Modell liest dein Foto. Wir speichern nichts.",
    photoNote: "Ein PDF-Ticket braucht das nicht: Es verlässt dein Gerät nie.",
    photoLoginPre: "Dafür musst du angemeldet sein.",
    photoRead: "Foto auslesen",
    photoSkip: "Lieber selbst eintippen",
    photoReading: "Lese das Foto …",
    photoDone: "Foto gelesen. Bitte prüfe jede Angabe genau.",
    photoFailed: "Das Foto ließ sich nicht lesen. Bitte fülle die Felder selbst aus.",
    scanLead: "Anthropics KI-Modell liest den Scan. Wir speichern nichts.",
    scanRead: "Scan auslesen",
    scanReading: "Lese den Scan …",
    scanDone: "Scan gelesen. Bitte prüfe jede Angabe genau.",
    scanFailed: "Der Scan ließ sich nicht lesen. Bitte fülle die Felder selbst aus.",
    photoBusy: "Gerade zu viele Anfragen – bitte versuche es in ein paar Minuten noch einmal oder fülle die Felder selbst aus.",
    plannedTitle: "Geplante Fahrt",
    fBooking: "Auftragsnummer",
    fPrice: "Ticketpreis (€)",
    fOperator: "Eisenbahnunternehmen",
    fFrom: "Abfahrtsbahnhof",
    fTo: "Zielbahnhof",
    fDate: "Reisetag",
    fDep: "Abfahrt laut Plan",
    fArr: "Ankunft laut Plan",
    fTrains: "Züge laut Ticket",
    actualTitle: "Was ist passiert?",
    rDelay: "Verspätung",
    rCancel: "Zug ausgefallen",
    rMissed: "Anschluss verpasst",
    rRefund: "Ich habe die Fahrt wegen der Verspätung oder des Ausfalls nicht gemacht oder abgebrochen: Ticketpreis erstatten statt Entschädigung.",
    refundLine: "Erstattung des Ticketpreises statt einer Entschädigung",
    fActDate: "Tatsächlicher Ankunftstag",
    fActArr: "Tatsächliche Ankunft",
    fActDep: "Tatsächliche Abfahrt",
    fActTrains: "Züge, mit denen du gefahren bist",
    fMissedAt: "Anschluss verpasst in",
    delayLine: (min, pct, amount) => pct ? `${pct} % des Ticketpreises${amount ? `, etwa ${amount}` : ""}` : "Unter 60 Minuten Verspätung gibt es keine Entschädigung.",
    needReason: "Bitte kreuze an, was passiert ist.",
    costsTitle: "Hattest du zusätzliche Kosten?",
    costsLead: "Wenn nicht, geh einfach weiter. Belege bleiben wie alles andere auf deinem Gerät.",
    costsHintTitle: "Was die Bahn erstatten kann",
    costsHintHotel: "Hotel und die Fahrt dorthin, wenn du am selben Tag nicht mehr weiterkamst und die Bahn keine Unterkunft gestellt hat.",
    costsHintTaxi: "Taxi bis 120 €, wenn die Ankunft zwischen 0 und 5 Uhr geplant war oder die letzte Verbindung des Tages ausfiel.",
    costsHintOther: "Ticket für Bus oder einen anderen Zug, das du selbst gekauft hast, weil die Bahn dir binnen 100 Minuten keine Weiterfahrt anbot.",
    costsHintFood: "Essen und Getränke während des Wartens, in angemessenem Verhältnis zur Wartezeit.",
    costsHintNote: "Tippe auf ein Symbol, um zu sehen, wann es erstattet wird. Heb die Originalbelege auf.",
    costAdd: "+ Kosten hinzufügen",
    costKind: "Art",
    costHotel: "Hotel",
    costTaxi: "Taxi",
    costTransport: "Anderes Ticket (Bus, Zug)",
    hintTicket: "Bus, Bahn",
    hintFood: "Essen",
    costFood: "Essen und Getränke",
    costOther: "Sonstiges",
    costAmount: "Betrag (€)",
    costReceipt: "Beleg anhängen *",
    costReceiptChange: "Beleg ändern",
    costRemove: "Entfernen",
    needCost: "Bitte trage zu jedem Posten einen Betrag ein oder entferne ihn.",
    needReceipt: "Bitte hänge zu jedem Posten den Beleg an oder entferne ihn.",
    needField: (label) => `Bitte ausfüllen: ${label}.`,
    needEmail: "Diese E-Mail-Adresse ist nicht gültig. Bitte prüfe sie.",
    youTitle: "Deine Angaben für den Antrag",
    youLead: "Diese Angaben stehen nur im Antrag, den du selbst abschickst. Sie werden nicht an DelayBahn übertragen und bleiben auf deinem Gerät.",
    fFirst: "Vorname",
    fLast: "Nachname",
    fStreet: "Straße",
    fHouse: "Nr.",
    fZip: "PLZ",
    fCity: "Ort",
    fCountry: "Land",
    fEmail: "E-Mail (am besten die der Buchung)",
    fPhone: "Telefon (optional)",
    payTitle: "Auszahlung",
    payMoney: "Überweisung",
    payVoucher: "Gutschein",
    fIban: "IBAN",
    fBic: "BIC (optional)",
    keepDetails: "Meine Angaben auf diesem Gerät merken",
    fHolder: "Kontoinhaber",
    shareOk: "Die Bahn darf meine Daten weitergeben, wenn das für die Bearbeitung nötig ist (z. B. an ein anderes Eisenbahnunternehmen). Empfohlen – so läuft die Bearbeitung reibungsloser.",
    needIban: "Diese IBAN ist nicht gültig. Bitte prüfe sie.",
    reviewTitle: "Das geht an die Bahn",
    reviewLead: "Tippe ein Dokument an, um es zu vergrößern. Stimmt etwas nicht, geh zurück und ändere es.",
    reviewBuilding: "Erstelle den Antrag …",
    reviewFailed: "Der Antrag ließ sich nicht erstellen. Bitte lade die Seite neu und versuche es noch einmal.",
    reviewOk: "Ich habe alle Angaben geprüft, sie sind richtig. DelayBahn ist nur eine Ausfüllhilfe und übernimmt keine Verantwortung für den Antrag oder die Entscheidung der Bahn.",
    sheetForm: (n, of) => `Antrag, Seite ${n} von ${of}`,
    sheetFormAll: "Antrag",
    sheetPages: (n) => `${n} Seiten`,
    sheetPrev: "Vorherige Seite",
    sheetNext: "Nächste Seite",
    sheetRecord: "Verspätungsnachweis",
    sheetTicket: "Ticket",
    sheetReceipt: (kind) => `Beleg: ${kind}`,
    sumLine: (total) => `Du beantragst voraussichtlich ${total}*`,
    sumNote: (pct, comp, costs) => `*Schätzung: ${pct ? `${pct} % des Ticketpreises (${comp})` : "keine Entschädigung nach Ticketpreis"}${costs ? ` plus ${costs} zusätzliche Kosten` : ""}.`,
    sumMin: "Beträge unter 4 € zahlt die Bahn nicht aus.",
    sumNoteRefund: (price, costs) => `*Schätzung: Erstattung des Ticketpreises (${price})${costs ? ` plus ${costs} zusätzliche Kosten` : ""}.`,
    sendTitle: "Schick den Antrag an die Bahn",
    sendLead: "Der Antrag geht von deiner eigenen E-Mail-Adresse an das Servicecenter Fahrgastrechte der Deutschen Bahn.",
    sendStep1: "Lade den Antrag herunter.",
    sendStepMail: "Öffne die E-Mail.",
    sendDownload: "Antrag herunterladen",
    sendAttachNote: (name) => `Hänge die heruntergeladene Datei ${name} an die E-Mail an.`,
    sendStepAttach: "Prüfe den Anhang, bevor du sendest.",
    sendAttached: "Ich habe den Antrag an die E-Mail angehängt.",
    sendSubject: "Betreff",
    sendCopyOne: "Kopieren",
    sendMail: "E-Mail öffnen",
    sendCopy: "E-Mail kopieren",
    sendCopied: "Kopiert",
    sendTo: "An",
    sendStep3: "Abgeschickt? Dann bist du fertig.",
    sendDone: "Ich habe den Antrag abgeschickt",
    mailBody: (name, booking) => `Sehr geehrte Damen und Herren,\n\nim Anhang erhalten Sie meinen Antrag auf Entschädigung/Erstattung nach der Verordnung (EU) 2021/782 auf dem einheitlichen EU-Formular, zusammen mit Fahrkarte und Belegen.\n\nAuftragsnummer: ${booking}\n\nMit freundlichen Grüßen\n${name}`,
    doneTitle: "Eingereicht.",
    doneAmount: (total) => `Beantragt: ${total}*`,
    doneLead: "Die Bahn antwortet dir per E-Mail und überweist auf dein Konto. Hebe Antrag und Originalbelege auf.",
    doneLeadVoucher: "Die Bahn antwortet dir per E-Mail und schickt dir den Gutschein. Hebe Antrag und Originalbelege auf.",
    doneTrips: "Zu meinen Fahrten",
    doneArt: "Ein Tier winkt mit deinem Antrag",
    referBtn: "Freunden schicken",
    referCopied: "Nachricht kopiert",
    referText: (amount) => `Mein Zug hatte Verspätung – mit DelayBahn habe ich in ein paar Minuten ${amount ? `${amount} ` : "eine "}Entschädigung bei der Bahn beantragt.`,
    referTry: "Probier es aus:",
    referSubject: "Entschädigung für Zugverspätung",
    referMail: "Per E-Mail schicken",
    referCopy: "Nachricht kopieren",
    doneAskTitle: "Du hast gerade „Einfach beantragen“ in der kostenlosen Testphase genutzt.",
    doneAsk: "Hilf uns und erzähl deinen Freunden von DelayBahn.",
    startTitle: "Prüfe zuerst deine Fahrt",
    startLead: "Der Antrag baut auf der Verspätung auf, die DelayBahn für deine Fahrt aufgezeichnet hat. Such die Fahrt in der Entschädigungsprüfung und tippe dort auf den grünen Button.",
    startGo: "Zur Entschädigungsprüfung",
    footerBack: "← Zur Verbindungssuche",
    footerLegal: "Impressum & Datenschutz",
    footerContact: "Kontakt",
    recordTitle: "Verspätungsnachweis",
    recordLead: "Von DelayBahn (delaybahn.com) aus Echtzeitdaten der Deutschen Bahn aufgezeichnet.",
    recordPlanned: "Ankunft laut Fahrplan",
    recordActual: "Tatsächliche Ankunft",
    recordDelay: "Verspätung am Ziel",
    recordStory: "Was passiert ist",
    recordBooked: "Gebuchte Reise",
    recordTravelled: "Nächste realistische Verbindung",
    recordRan: "So fuhren die gebuchten Züge",
    recColTrain: "Zug",
    recColDep: "Abfahrt laut Fahrplan",
    recColArr: "Ankunft laut Fahrplan",
    recColDepReal: "Tatsächliche Abfahrt",
    recColArrReal: "Tatsächliche Ankunft",
    recColStatus: "Am Reisetag",
    recColDelay: "Verspätung",
    recOnTime: "pünktlich",
    recLate: (n) => `${n} Min. verspätet`,
    recNoData: "keine Daten",
    recCancelled: "ausgefallen",
    recMissed: "Anschluss verpasst",
    recNotTravelled: "nicht mehr erreichbar",
    recEnded: (station) => `endete in ${station}`,
    storyEnded: (train, station, time) => `${train} fuhr nicht die ganze Strecke: Der Zug endete in ${station} (an ${time}).`,
    storyCancelled: (train, station) => `${train} ab ${station} ist ausgefallen.`,
    storyLateInto: (train, station, n) => `${train} erreichte ${station} mit ${n} Min. Verspätung.`,
    storyMissed: (train, station, time) => `Der Anschluss an ${train} in ${station}${time ? ` (ab ${time})` : ""} wurde verpasst.`,
    storyOnward: (to, time, n) => `Die nächste realistische Verbindung erreichte ${to} um ${time} Uhr, ${n} Min. später als gebucht.`,
    storyArrived: (to, time, n) => `Die Reise erreichte ${to} um ${time} Uhr, ${n} Min. später als gebucht.`,
    storyUnknown: "Wie die Reise weiterging, zeigen die Daten von DelayBahn nicht.",
    recordFoot: "Dieser Nachweis ist keine amtliche Bestätigung. Maßgeblich sind die Daten der Deutschen Bahn.",
    costsInfo: "Zusätzliche Kosten",
  },
  en: {
    docTitle: "Claim compensation – DelayBahn",
    headerTitle: "Claim compensation",
    tagline: "Fill in the form, check it, send it yourself",
    navLogin: "Log in",
    trial: "Free during the trial",
    stopTicket: "Ticket",
    stopCosts: "Costs",
    stopYou: "Your details",
    stopReview: "Review",
    stopSend: "Send",
    next: "Continue",
    back: "Back",
    feedbackAsk: "Was this step clear?",
    feedbackAskDone: "Was filing the claim easy?",
    feedbackYes: "Yes",
    feedbackNo: "No",
    feedbackDismiss: "Dismiss",
    feedbackFollowUp: "Thanks! What could be better?",
    feedbackPlaceholder: "What helped, what was missing or in the way? The more specific, the better.",
    feedbackSend: "Send",
    feedbackThanks: "Thanks for your feedback.",
    close: "Close",
    formats: "PDF, JPG or PNG",
    badFormat: "Deutsche Bahn does not accept this file format. Please upload a PDF, JPG or PNG.",
    tooBig: "The file is too large (10 MB at most).",
    tripTitle: "Your journey",
    ticketTitle: "Your ticket",
    ticketFormats: "PDF, screenshot or photo (JPG, PNG)",
    ticketRequired: "Deutsche Bahn requires the ticket with your claim.",
    ticketDrop: "Upload your ticket or drop it here",
    ticketReading: "Reading the ticket …",
    ticketRead: (name) => `Ticket read: ${name}. The file never left your device.`,
    ticketPartial: "We could not read everything. Please fill in the missing fields.",
    ticketFailed: "We could not read the ticket. You can fill in the fields yourself – the ticket is still attached.",
    editTitle: "Correct the details",
    lDay: "Travel date",
    lPlan: "Scheduled",
    lTrains: "Trains",
    navLogout: "Logout",
    gateLead: "Easy apply is free for members. All we ask in return is a free DelayBahn account. Your claim stays exactly as you left it.",
    lActual: "Actually arrived",
    lTook: "Next realistic journey",
    lMissed: "Connection missed at",
    lCancelled: "Cancelled train",
    vCancelled: "Train cancelled",
    vCancelledFrom: (train, station) => `${train} from ${station}`,
    lTicket: "Ticket",
    vActual: (day, time) => `${time}, ${day}`,
    vLate: (min) => `+${min} min`,
    needTicket: "Please upload your ticket. Deutsche Bahn requires it with your claim.",
    ticketNotDb: "This does not look like a Deutsche Bahn ticket. Please upload your DB ticket (PDF, JPG or PNG).",
    ticketInvoice: "This is the invoice, not the ticket. Please upload the ticket itself.",
    photoLead: "Anthropic's AI model reads your photo. We store nothing.",
    photoNote: "A PDF ticket does not need this: it never leaves your device.",
    photoLoginPre: "You need to be logged in for this.",
    photoRead: "Read the photo",
    photoSkip: "I'd rather type it in",
    photoReading: "Reading the photo …",
    photoDone: "Photo read. Please check every detail carefully.",
    photoFailed: "We could not read the photo. Please fill in the fields yourself.",
    scanLead: "Anthropic's AI model reads the scan. We store nothing.",
    scanRead: "Read the scan",
    scanReading: "Reading the scan …",
    scanDone: "Scan read. Please check every detail carefully.",
    scanFailed: "We could not read the scan. Please fill in the fields yourself.",
    photoBusy: "Too many requests right now – please try again in a few minutes or fill in the fields yourself.",
    plannedTitle: "Scheduled journey",
    fBooking: "Order number",
    fPrice: "Ticket price (€)",
    fOperator: "Railway company",
    fFrom: "Departure station",
    fTo: "Destination station",
    fDate: "Travel date",
    fDep: "Scheduled departure",
    fArr: "Scheduled arrival",
    fTrains: "Trains on the ticket",
    actualTitle: "What happened?",
    rDelay: "Delay",
    rCancel: "Train cancelled",
    rMissed: "Missed connection",
    rRefund: "I gave up the trip because of the delay or cancellation: refund the ticket instead of compensation.",
    refundLine: "Refund of the ticket price instead of compensation",
    fActDate: "Actual arrival date",
    fActArr: "Actual arrival",
    fActDep: "Actual departure",
    fActTrains: "Trains you actually took",
    fMissedAt: "Connection missed at",
    delayLine: (min, pct, amount) => pct ? `${pct}% of the ticket price${amount ? `, about ${amount}` : ""}` : "There is no compensation for less than 60 minutes.",
    needReason: "Please tick what happened.",
    costsTitle: "Did you have extra costs?",
    costsLead: "If not, just continue. Receipts stay on your device like everything else.",
    costsHintTitle: "What Deutsche Bahn can reimburse",
    costsHintHotel: "A hotel and the ride there, when you could not continue the same day and DB did not provide a room.",
    costsHintTaxi: "A taxi up to €120, when arrival was scheduled between midnight and 5 am or the last connection of the day was cancelled.",
    costsHintOther: "A bus or other train ticket you bought yourself because DB offered you no onward journey within 100 minutes.",
    costsHintFood: "Food and drinks while you waited, in reasonable proportion to the waiting time.",
    costsHintNote: "Tap an icon to see when it is reimbursed. Keep the original receipts.",
    costAdd: "+ Add a cost",
    costKind: "Type",
    costHotel: "Hotel",
    costTaxi: "Taxi",
    costTransport: "Other ticket (bus, train)",
    hintTicket: "Bus, train",
    hintFood: "Food",
    costFood: "Food and drinks",
    costOther: "Other",
    costAmount: "Amount (€)",
    costReceipt: "Attach receipt *",
    costReceiptChange: "Change receipt",
    costRemove: "Remove",
    needCost: "Please enter an amount for every item or remove it.",
    needReceipt: "Please attach the receipt for every item or remove it.",
    needField: (label) => `Please fill in: ${label}.`,
    needEmail: "This email address is not valid. Please check it.",
    youTitle: "Your details for the claim",
    youLead: "These details only appear in the form you send yourself. They are not transferred to DelayBahn and stay on your device.",
    fFirst: "First name",
    fLast: "Last name",
    fStreet: "Street",
    fHouse: "No.",
    fZip: "Postal code",
    fCity: "City",
    fCountry: "Country",
    fEmail: "Email (ideally the one used for booking)",
    fPhone: "Phone (optional)",
    payTitle: "Payout",
    payMoney: "Bank transfer",
    payVoucher: "Voucher",
    fIban: "IBAN",
    fBic: "BIC (optional)",
    keepDetails: "Remember my details on this device",
    fHolder: "Account holder",
    shareOk: "Deutsche Bahn may pass on my data where that is needed to process the claim (e.g. to another railway company). Recommended – it keeps processing smooth.",
    needIban: "This IBAN is not valid. Please check it.",
    reviewTitle: "This goes to Deutsche Bahn",
    reviewLead: "Tap a document to enlarge it. If something is wrong, go back and change it.",
    reviewBuilding: "Creating the form …",
    reviewFailed: "The form could not be created. Please reload the page and try again.",
    reviewOk: "I have checked all details and they are correct. DelayBahn only helps fill in the form and takes no responsibility for the claim or for Deutsche Bahn's decision.",
    sheetForm: (n, of) => `Form, page ${n} of ${of}`,
    sheetFormAll: "Form",
    sheetPages: (n) => `${n} pages`,
    sheetPrev: "Previous page",
    sheetNext: "Next page",
    sheetRecord: "Delay record",
    sheetTicket: "Ticket",
    sheetReceipt: (kind) => `Receipt: ${kind}`,
    sumLine: (total) => `You are claiming an estimated ${total}*`,
    sumNote: (pct, comp, costs) => `*Estimate: ${pct ? `${pct}% of the ticket price (${comp})` : "no compensation on the ticket price"}${costs ? ` plus ${costs} in extra costs` : ""}.`,
    sumMin: "DB does not pay out amounts under €4.",
    sumNoteRefund: (price, costs) => `*Estimate: refund of the ticket price (${price})${costs ? ` plus ${costs} in extra costs` : ""}.`,
    sendTitle: "Send the claim to Deutsche Bahn",
    sendLead: "The claim goes from your own email address to Deutsche Bahn's passenger rights service centre.",
    sendStep1: "Download the claim.",
    sendStepMail: "Open the email.",
    sendDownload: "Download the claim",
    sendAttachNote: (name) => `Attach the downloaded file ${name} to the email.`,
    sendStepAttach: "Check the attachment before you send.",
    sendAttached: "I have attached the claim to the email.",
    sendSubject: "Subject",
    sendCopyOne: "Copy",
    sendMail: "Open email",
    sendCopy: "Copy email",
    sendCopied: "Copied",
    sendTo: "To",
    sendStep3: "Sent? Then you are done.",
    sendDone: "I have sent the claim",
    mailBody: (name, booking) => `Dear Sir or Madam,\n\nplease find attached my claim for compensation/reimbursement under Regulation (EU) 2021/782 on the common EU form, together with my ticket and receipts.\n\nOrder number: ${booking}\n\nKind regards\n${name}`,
    doneTitle: "Submitted.",
    doneAmount: (total) => `Claimed: ${total}*`,
    doneLead: "Deutsche Bahn replies by email and pays into your bank account. Keep the claim and your original receipts.",
    doneLeadVoucher: "Deutsche Bahn replies by email and sends you the voucher. Keep the claim and your original receipts.",
    doneTrips: "To my trips",
    doneArt: "An animal waves with your claim",
    referBtn: "Send to friends",
    referCopied: "Message copied",
    referText: (amount) => `My train was late – with DelayBahn I claimed ${amount ? `${amount} in ` : ""}compensation from Deutsche Bahn in a few minutes.`,
    referTry: "Try it:",
    referSubject: "Compensation for a late train",
    referMail: "Send by email",
    referCopy: "Copy the message",
    doneAskTitle: "You just used the “Easy apply” free trial.",
    doneAsk: "Help us by telling your friends about DelayBahn.",
    startTitle: "Check your journey first",
    startLead: "The claim builds on the delay DelayBahn recorded for your journey. Find the journey in the compensation check and tap the green button there.",
    startGo: "To the compensation check",
    footerBack: "← Back to the connection search",
    footerLegal: "Imprint & privacy",
    footerContact: "Contact",
    recordTitle: "Delay record",
    recordLead: "Recorded by DelayBahn (delaybahn.com) from Deutsche Bahn's public real-time data.",
    recordPlanned: "Scheduled arrival",
    recordActual: "Actual arrival",
    recordDelay: "Delay at destination",
    recordStory: "What happened",
    recordBooked: "Journey as booked",
    recordTravelled: "Next realistic journey",
    recordRan: "How the booked trains ran",
    recColTrain: "Train",
    recColDep: "Scheduled departure",
    recColArr: "Scheduled arrival",
    recColDepReal: "Actual departure",
    recColArrReal: "Actual arrival",
    recColStatus: "On the day",
    recColDelay: "Delay",
    recOnTime: "on time",
    recLate: (n) => `${n} min late`,
    recNoData: "no data",
    recCancelled: "cancelled",
    recMissed: "connection missed",
    recNotTravelled: "no longer reachable",
    recEnded: (station) => `ended at ${station}`,
    storyEnded: (train, station, time) => `${train} did not run its full route: it ended at ${station} (arr. ${time}).`,
    storyCancelled: (train, station) => `${train} from ${station} was cancelled.`,
    storyLateInto: (train, station, n) => `${train} reached ${station} ${n} min late.`,
    storyMissed: (train, station, time) => `The connection to ${train} at ${station}${time ? ` (dep. ${time})` : ""} was missed.`,
    storyOnward: (to, time, n) => `The next realistic journey reached ${to} at ${time}, ${n} min later than booked.`,
    storyArrived: (to, time, n) => `The journey reached ${to} at ${time}, ${n} min later than booked.`,
    storyUnknown: "DelayBahn's data does not show how the journey continued.",
    recordFoot: "This record is not an official confirmation. Deutsche Bahn's own data is decisive.",
    costsInfo: "Extra costs",
  },
};

const lang = location.pathname.startsWith("/en/") ? "en" : "de";
const t = (key, ...args) => {
  const entry = I18N[lang][key];
  return typeof entry === "function" ? entry(...args) : entry;
};
const $ = (id) => document.getElementById(id);
/* Counts that a step happened - never anything about the claim itself. This
   script runs before the deferred Umami one, so an event from the first
   moments waits for the page load; a blocked Umami just drops it. */
const track = (name, data) => {
  if (window.umami) window.umami.track(name, data);
  else if (document.readyState !== "complete") {
    window.addEventListener("load", () => window.umami?.track(name, data), { once: true });
  }
};

const SELF = lang === "en" ? "/en/claim" : "/antrag";
const TRIPS = lang === "en" ? "/en/my-trips" : "/meine-fahrten";
const CHECK = lang === "en" ? "/en/compensation" : "/entschaedigung";
const LOGIN = "/login?next=" + encodeURIComponent(SELF);
// DB's inbox for the common EU form, and the subject line it asks for
const DB_ADDRESS = "EUAntragFGR@deutschebahn.com";
const DB_SUBJECT = "Fahrgastrechte: EU-Antragsformular";
const FORM_URL = `/claim/eu-form-${lang}.pdf?v=1`;
// reading a ticket is shared with the compensation check (ticket-read.js)
const { MAX_FILE, DB_MARK, INVOICE_MARK, fileKind, pdfRows, parseTicket, photoDataUrl } = window.TicketRead;
// DB pays nothing below this, per ticket
const MIN_PAYOUT = 4;
const ART = ["fox", "bear", "rabbit", "owl"];
// the form's fields in document order: both language versions share the
// order but not the names, so they are addressed by position
const F = {
  delay: 0, cancel: 1, missed: 2, operator: 6, date: 7, from: 8, to: 9, dep: 10, arr: 11,
  trains: 12, booking: 13, price: 14, actDate: 15, actDep: 16, actArr: 17, actTrains: 18,
  missedAt: 19, refund: 20, compensation: 21, late60: 22, late120: 23, costs: 25, first: 26, last: 27,
  street: 28, house: 29, country: 30, zip: 31, city: 32, email: 33, phone: 34, money: 35,
  voucher: 36, iban: 37, bic: 38, holder: 40, info: 41, shareYes: 42, shareNo: 43,
  today: 44, place: 45, signer: 46,
};
const FORM_FIELDS = 47;

let fb = null;
let me = null;          // { user } for a signed-in account
let step = 1;
let reached = 1;        // the furthest stop the visitor may jump back and forth to
let ticket = null;      // { file, kind } - the upload, attached to the packet as is
let pendingPhoto = null;
let record = null;      // DelayBahn's own data on the trip, when the claim started from one
let costs = [];         // [{ kind, amount, file }]
let packet = null;      // { bytes, sheets: [label per page], groups: [{ label, from, count }] }
let viewer = null;      // { pdf, at } while the review is on screen
let libs = null;

// --- small helpers ---

const euro = (n) => n.toLocaleString(lang === "en" ? "en-GB" : "de-DE", { style: "currency", currency: "EUR" });
const num = (s) => {
  const v = parseFloat(String(s).replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : null;
};
const val = (id) => $(id).value.trim();
const dmy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const addDay = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("script " + src));
    document.head.append(s);
  });
}

// the two PDF libraries are only fetched once a file is actually in play
function loadLibs() {
  libs = libs || Promise.all([
    window.TicketRead.loadPdfjs(), loadScript("/claim/pdf-lib.min.js?v=1"),
  ]).then(([pdfjs]) => ({ pdfjs, PDFLib: window.PDFLib }));
  return libs;
}

// what the review needs is fetched once, and ahead of time (see warm)
const once = (load) => {
  let got = null;
  return () => {
    got = got || load().catch((e) => { got = null; throw e; });
    return got;
  };
};
const formBytes = once(() => fetch(FORM_URL).then((r) => {
  if (!r.ok) throw new Error("form " + r.status);
  return r.arrayBuffer();
}));
// one PDF worker for every preview, started before the first one is asked for
const previewWorker = once(async () => {
  const { pdfjs } = await loadLibs();
  return pdfjs.PDFWorker ? new pdfjs.PDFWorker() : null;
});

// the steps before the review are the time to fetch what it will need
function warm() {
  [formBytes, logoBytes, previewWorker].forEach((load) => load().catch(() => {}));
}

function setStatus(id, text, error) {
  const el = $(id);
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("error", !!error);
}

// --- the delay and what it is worth ---

/* Minutes late at the destination from the planned and the actual arrival.
   A planned arrival before the departure time means the journey runs past
   midnight; the actual arrival carries its own date. */
function delayMinutes() {
  const date = val("f-date"), dep = val("f-dep"), arr = val("f-arr");
  const actDate = val("f-act-date"), actArr = val("f-act-arr");
  if (!date || !arr || !actDate || !actArr) return null;
  const arrDay = dep && arr < dep ? addDay(date) : date;
  const mins = Math.round((new Date(`${actDate}T${actArr}`) - new Date(`${arrDay}T${arr}`)) / 60000);
  return Number.isFinite(mins) ? mins : null;
}

const pctFor = (mins) => (mins == null || mins < 60 ? 0 : mins < 120 ? 25 : 50);

let cancelledTrains = "";
const refunding = () => $("r-refund").checked;

function amounts() {
  const price = num(val("f-price")) || 0;
  const extra0 = costs.reduce((sum, c) => sum + (num(c.amount) || 0), 0);
  if (refunding()) return { pct: 0, comp: price, extra: extra0, total: price + extra0, belowMin: false, refund: true };
  const pct = pctFor(delayMinutes());
  let comp = Math.round(price * pct) / 100;
  const belowMin = comp > 0 && comp < MIN_PAYOUT;
  if (belowMin) comp = 0;
  const extra = costs.reduce((sum, c) => sum + (num(c.amount) || 0), 0);
  return { pct, comp, extra, total: comp + extra, belowMin };
}

// what the estimate is made of, for the review and the last page
function noteText(a) {
  if (a.refund) return t("sumNoteRefund", euro(a.comp), a.extra ? euro(a.extra) : "");
  return t("sumNote", a.belowMin ? 0 : a.pct, euro(a.comp), a.extra ? euro(a.extra) : "")
    + (a.belowMin ? " " + t("sumMin") : "");
}

const fmtDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(
  lang === "en" ? "en-GB" : "de-DE", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/* The journey as the page knows it, in a few lines instead of a form: the
   fields behind it stay folded away under "correct the details". */
function renderTrip() {
  const filled = val("f-from") && val("f-to") && val("f-date");
  $("trip-summary").classList.toggle("hidden", !filled);
  if (!filled) return;
  $("trip-route").textContent = `${val("f-from")} → ${val("f-to")}`;
  const mins = refunding() ? null : delayMinutes();
  $("trip-late").textContent = mins > 0 ? t("vLate", mins) : "";
  const price = num(val("f-price"));
  const rows = [
    ["lDay", fmtDay(val("f-date"))],
    ["lPlan", `${val("f-dep")} – ${val("f-arr")}`],
    ["lTrains", val("f-trains")],
    ["lActual", !refunding() && val("f-act-date") && val("f-act-arr") ? t("vActual", fmtDay(val("f-act-date")), val("f-act-arr")) : ""],
    ["lTook", !refunding() && val("f-act-trains") !== val("f-trains") ? val("f-act-trains") : ""],
    ["lMissed", $("r-missed").checked ? val("f-missed-at") : ""],
    ["lCancelled", $("r-cancel").checked ? cancelledTrains || t("vCancelled") : ""],
    ["lTicket", val("f-booking") ? [val("f-booking"), price ? euro(price) : ""].filter(Boolean).join(", ") : ""],
  ];
  // the checked journey is drawn as on the search, as long as the fields still say what it said
  const drawn = !!record && record.whole && record.key === tripKey();
  $("trip-times").textContent = "";
  $("trip-legs").textContent = "";
  if (drawn) {
    const times = $("trip-times");
    const actual = mins > 0 && val("f-act-arr");
    times.append(`${fmtDay(val("f-date"))} · ${val("f-dep")} → `);
    if (actual) {
      const planned = document.createElement("s");
      planned.textContent = val("f-arr");
      times.append(planned, ` ${val("f-act-arr")}${val("f-act-date") !== val("f-date") ? ` (${fmtDay(val("f-act-date"))})` : ""}`);
    } else times.append(val("f-arr"));
    const legs = $("trip-legs");
    legRows(legs, record.plan);
    if (!refunding() && record.onward.length) {
      const cont = document.createElement("div");
      cont.className = "leg-continuation";
      cont.textContent = `↳ ${t("lTook")}:`;
      legs.append(cont);
      legRows(legs, record.onward);
    }
  }
  const facts = $("trip-facts");
  facts.textContent = "";
  // drawn, the rows say the rest; a cancellation or a lost connection no row is marked with keeps its line
  const marked = (key) => record.plan.some((l) => l.mark && l.mark[1] === t(key));
  const kept = { lTicket: true, lCancelled: drawn && !marked("recCancelled"), lMissed: drawn && !marked("recMissed") && !record.plan.some((l) => l.endedEarly) };
  rows.filter(([key, value]) => value && (!drawn || kept[key])).forEach(([key, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = t(key);
    const dd = document.createElement("dd");
    dd.textContent = value;
    facts.append(dt, dd);
  });
}

// everything the drawn journey shows: once one of these is corrected, the summary falls back to plain lines
const tripKey = () => JSON.stringify(["f-from", "f-to", "f-date", "f-dep", "f-arr", "f-trains", "f-act-date", "f-act-arr", "f-act-trains", "f-missed-at"]
  .map(val).concat($("r-missed").checked, $("r-cancel").checked));

function legRows(into, legs) {
  legs.forEach((leg, i) => {
    const row = document.createElement("div");
    row.className = "leg" + (leg.struck ? " leg-missed" : "") + (i === 0 ? " rail-first" : "") + (i === legs.length - 1 ? " rail-last" : "");
    const train = document.createElement("span");
    train.className = "train";
    train.textContent = leg.name;
    const desc = document.createElement("span");
    desc.className = "leg-desc";
    // a time the train ran off is struck, the time it ran follows
    const time = (planned, real) => {
      if (!real || real === planned) return [planned];
      const was = document.createElement("s");
      was.className = "time-planned";
      was.textContent = planned;
      const ran = document.createElement("span");
      ran.className = "time-live";
      ran.textContent = real;
      return [was, " ", ran];
    };
    desc.append(`${leg.from} `, ...time(leg.dep, leg.depReal), ` → ${leg.to} `, ...time(leg.arr, leg.arrReal));
    row.append(train, desc);
    if (leg.mark) {
      const mark = document.createElement("span");
      mark.className = `badge ${leg.mark[0]}`;
      mark.textContent = leg.mark[1];
      row.append(mark);
    }
    into.append(row);
  });
}

function renderDelay() {
  renderTrip();
  $("actual-fields").classList.toggle("hidden", refunding());
  $("missed-field").classList.toggle("hidden", !$("r-missed").checked);
  if (refunding()) {
    $("delay-line").textContent = t("refundLine");
    $("delay-line").classList.add("claim-delay-yes");
    return;
  }
  let mins = delayMinutes();
  // an arrival time earlier than the planned one, on the planned day, is
  // almost always the small hours of the next day
  if (mins != null && mins < 0 && mins > -1440) {
    const arrDay = val("f-dep") && val("f-arr") < val("f-dep") ? addDay(val("f-date")) : val("f-date");
    if (val("f-act-date") === arrDay && val("f-act-arr") < "12:00") {
      $("f-act-date").value = addDay(arrDay);
      mins = delayMinutes();
    }
  }
  const el = $("delay-line");
  if (mins == null || mins < 0) { el.textContent = ""; return; }
  const { pct, comp } = amounts();
  el.textContent = t("delayLine", mins, pct, comp ? euro(comp) : "");
  el.classList.toggle("claim-delay-yes", pct > 0);
}

// --- reading a PDF ticket, on the device ---

// products that are not trains, as in the trips page (UNTRACKED_PRODUCTS in app/main.py)
const NOT_TRACKED = new Set(["BUS", "TRAM", "UBAHN", "SCHIFF", "ANRUFPFLICHTIG", "ERSATZVERKEHR"]);
// another railway's ticket: said plainly, and the upload is not kept
function refuseTicket(why) {
  ticket = null;
  pendingPhoto = null;
  $("ticket-file").value = "";
  $("ticket-drop").classList.remove("claim-drop-has");
  $("ticket-drop").querySelector(".claim-drop-main").textContent = t("ticketDrop");
  $("photo-consent").classList.add("hidden");
  setStatus("ticket-status", t(why || "ticketNotDb"), true);
  track(why === "ticketInvoice" ? "claim-invoice" : "claim-not-db");
}

function splitName(name) {
  const parts = (name || "").trim().split(/\s+/);
  if (parts.length < 2) return { first: parts[0] || "", last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

// fill what was read without overwriting anything the visitor already typed
function applyFields(data) {
  const set = (id, value) => { if (value && !$(id).value) $(id).value = value; };
  set("f-booking", data.booking);
  set("f-price", data.price);
  set("f-from", data.from);
  set("f-to", data.to);
  set("f-date", data.date);
  set("f-dep", data.dep);
  set("f-arr", data.arr);
  set("f-trains", data.trains);
  if (data.name) {
    const who = splitName(data.name);
    set("f-first", who.first);
    set("f-last", who.last);
    set("f-holder", data.name);
  }
  // an invoice or a printed ticket may carry the address as well
  set("f-street", data.street);
  set("f-house", data.house);
  set("f-zip", data.zip);
  set("f-city", data.city);
  if (val("f-date") && !val("f-act-date")) {
    $("f-act-date").value = val("f-dep") && val("f-arr") < val("f-dep") ? addDay(val("f-date")) : val("f-date");
  }
  renderDelay();
}

// what the uploaded ticket left open is asked for under it
function askTicketGaps() {
  if (ticket && (!val("f-booking") || !val("f-price"))) $("ticket-fields").classList.remove("hidden");
}

/* The gate every upload passes: DB only takes PDF, JPG and PNG, so another
   format is refused here with a message instead of failing at DB. */
function checkFile(file, errorId) {
  if (!fileKind(file)) { setStatus(errorId, t("badFormat"), true); alert(t("badFormat")); return false; }
  if (file.size > MAX_FILE) { setStatus(errorId, t("tooBig"), true); return false; }
  setStatus(errorId, "");
  return true;
}

// the upload, kept for the packet and named in the drop
function holdTicket(file) {
  ticket = { file, kind: fileKind(file) };
  $("ticket-drop").classList.add("claim-drop-has");
  $("ticket-drop").querySelector(".claim-drop-main").textContent = file.name;
}

/* A ticket uploaded at the compensation check comes along, when this claim is
   for the journey it was searched for. A PDF is read again here; a photo's
   fields come with it, since reading it again would ask and count again. */
async function adoptKept() {
  const had = await window.TicketRead.kept();
  if (!had || !had.file || had.pending || had.date !== record.date) return;
  if (!had.fields) { await onTicket(had.file); return; }
  holdTicket(had.file);
  applyFields(had.fields);
  askTicketGaps();
  setStatus("ticket-status", t(fileKind(had.file) === "pdf" ? "scanDone" : "photoDone"));
}

async function onTicket(file) {
  if (!file || !checkFile(file, "ticket-status")) { $("ticket-file").value = ""; return; }
  const kind = fileKind(file);
  holdTicket(file);
  packet = null;
  $("photo-consent").classList.add("hidden");
  if (kind !== "pdf") { askPhoto(file); return; }
  setStatus("ticket-status", t("ticketReading"));
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const rows = await pdfRows(bytes);
    // a scan has pages but no text: it is a photo in a PDF wrapper
    if (rows.length < 5) { askPhoto(file); return; }
    const text = rows.map((r) => r.text).join("\n");
    // the invoice for a ticket names the order but not the journey: DB wants the ticket itself
    if (INVOICE_MARK.test(text)) { refuseTicket("ticketInvoice"); return; }
    if (!DB_MARK.test(text)) { refuseTicket(); return; }
    const data = parseTicket(rows, record ? record.date : null);
    // Deutsche Bahn is named, but there is neither an order number nor a journey: some other document
    if (!data.booking && !data.from && !data.to) { refuseTicket(); return; }
    applyFields(data);
    askTicketGaps();
    const complete = data.booking && data.from && data.to && data.dep && data.arr;
    setStatus("ticket-status", complete ? t("ticketRead", file.name) : t("ticketPartial"));
    track("claim-ticket");
  } catch (e) {
    askTicketGaps();
    setStatus("ticket-status", t("ticketFailed"), true);
  }
}

// --- reading a photo: the one step that leaves the device, and only on a tick ---

// a scanned PDF takes the same road as a photo, but is not called one
const photoWord = (suffix) => t((pendingPhoto && fileKind(pendingPhoto) === "pdf" ? "scan" : "photo") + suffix);

function askPhoto(file) {
  pendingPhoto = file;
  setStatus("ticket-status", "");
  $("photo-consent").classList.remove("hidden");
  $("photo-consent").querySelector("p").textContent = photoWord("Lead");
  // a scan is a PDF that does get sent: the line about PDFs would be wrong there
  $("photo-note").classList.toggle("hidden", fileKind(file) === "pdf");
  $("photo-read").textContent = photoWord("Read");
  $("photo-login").classList.toggle("hidden", !!me);
  $("photo-read").disabled = !me;
}

async function readPhoto() {
  if (!pendingPhoto || !me) return;
  $("photo-read").disabled = true;
  setStatus("ticket-status", photoWord("Reading"));
  try {
    const image = await photoDataUrl(pendingPhoto);
    const token = await me.user.getIdToken();
    const resp = await fetch("/api/claim/read-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ image }),
    });
    if (!resp.ok) {
      const err = new Error("http " + resp.status);
      err.status = resp.status;
      throw err;
    }
    const read = await resp.json();
    if (read.invoice) { refuseTicket("ticketInvoice"); return; }
    if (!read.db) { refuseTicket(); return; }
    applyFields(read);
    setStatus("ticket-status", photoWord("Done"));
    track("claim-photo");
  } catch (e) {
    setStatus("ticket-status", e.status === 429 ? t("photoBusy") : photoWord("Failed"), true);
  }
  $("photo-consent").classList.add("hidden");
  askTicketGaps();
}

// --- a claim started from a saved trip brings DelayBahn's own record of the day ---

// regional lines carry a line number in the name and the train's own number beside it
const legName = (l) => [l.line && l.line.name, l.line && l.line.fahrtNr && !String(l.line.name || "").includes(l.line.fahrtNr)
  ? `(${l.line.fahrtNr})` : ""].join(" ").trim();

const shiftClock = (iso, minutes) => {
  const d = new Date(iso.slice(0, 16));
  d.setMinutes(d.getMinutes() + minutes);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/* The record page tells the day twice: the journey as booked, with what
   became of each train, and how the day went on - the booked trains as they
   ran, or the next realistic journey once a connection was lost. Which trains
   the visitor really took is not known here. */
function recordJourneys(verdict) {
  const all = verdict.legs || [];
  const sim = verdict.simulation || null;
  const cut = sim && sim.missedAtLegIndex != null ? sim.missedAtLegIndex : null;
  const miss = (verdict.missedTransfers || [])[0] || null;
  const shown = (l) => !l.walking && l.line && !NOT_TRACKED.has(l.line.product);
  const clock = (iso) => (iso ? iso.slice(11, 16) : "");
  const late = (d) => (!d || d.delayMin == null ? t("recNoData") : d.delayMin > 0 ? t("recLate", d.delayMin) : t("recOnTime"));

  record.booked = all.map((l, i) => ({ l, i })).filter(({ l }) => shown(l)).map(({ l, i }) => {
    const d = l.delayOnDate;
    let status;
    if (l.endedEarly) status = t("recEnded", l.endedEarly.station);
    else if (cut != null && i >= cut) {
      status = i > cut ? t("recNotTravelled") : miss && miss.canceled ? t("recCancelled") : t("recMissed");
    } else if (l.departureCanceled || (d && d.canceled)) status = t("recCancelled");
    else status = late(d);
    return { name: legName(l), from: `${clock(l.plannedDeparture)} ${l.origin.name}`, to: `${clock(l.plannedArrival)} ${l.destination.name}`, status };
  });

  // the same two tellings as rows for the first page, each train with the badge the search gives it
  const lateMark = (d) => (!d || d.canceled || d.delayMin == null ? null
    : [d.delayMin < 3 ? "green" : d.delayMin < 10 ? "yellow" : "red", `${d.delayMin >= 0 ? "+" : ""}${d.delayMin} min`]);
  const ranAt = (planned, d) => (planned && d && !d.canceled && d.delayMin ? shiftClock(planned, d.delayMin) : "");
  // `ridden` is false for a train that was lost: it keeps its plan
  const stops = (l, ridden) => ({
    name: legName(l), from: l.origin.name, dep: clock(l.plannedDeparture), to: l.destination.name, arr: clock(l.plannedArrival),
    depReal: ridden ? ranAt(l.plannedDeparture, l.departureOnDate) : "",
    arrReal: ridden && !l.endedEarly ? ranAt(l.plannedArrival, l.delayOnDate) : "",
  });
  record.plan = all.map((l, i) => ({ l, i })).filter(({ l }) => shown(l)).map(({ l, i }) => {
    const d = l.delayOnDate;
    const lost = cut != null && i >= cut;
    const gone = lost ? i === cut && miss && miss.canceled : l.departureCanceled || (d && d.canceled);
    let mark = null;
    if (l.endedEarly) mark = ["gray", t("recEnded", l.endedEarly.station)];
    else if (gone) mark = ["red", t("recCancelled")];
    else if (lost) mark = ["gray", t(i > cut ? "recNotTravelled" : "recMissed")];
    else mark = lateMark(d);
    return { ...stops(l, !lost && !gone), mark, struck: !l.endedEarly && (lost || gone), endedEarly: !!l.endedEarly };
  });
  record.onward = (cut != null ? sim.legs || [] : []).filter((l) => !l.walking && l.line).map((l) => ({ ...stops(l, true), mark: lateMark(l.delayOnDate), struck: false }));

  record.rerouted = cut != null;
  const ridden = (cut != null ? all.slice(0, cut).concat(sim.legs || []) : all).filter(shown);
  record.travelled = ridden.filter((l) => !(l.delayOnDate && l.delayOnDate.canceled && !l.endedEarly)).map((l) => {
    const d = l.delayOnDate, short = l.endedEarly;
    const arr = short ? clock(short.arrival) : d && d.delayMin != null ? shiftClock(l.plannedArrival, d.delayMin) : clock(l.plannedArrival);
    const left = l.departureOnDate;
    const dep = left && !left.canceled && left.delayMin != null ? shiftClock(l.plannedDeparture, left.delayMin) : clock(l.plannedDeparture);
    return {
      name: legName(l), from: `${dep} ${l.origin.name}`,
      to: `${arr} ${short ? short.station : l.destination.name}`,
      status: short ? late({ delayMin: short.delayMin }) : late(d),
    };
  });

  const story = [];
  const last = record.legs[record.legs.length - 1];
  if (miss && miss.endedEarly) story.push(t("storyEnded", miss.trainName, miss.station, clock(miss.endedArrival)));
  else if (miss && miss.canceled) story.push(t("storyCancelled", miss.trainName, miss.station));
  else if (miss) {
    const before = all[miss.legIndex], lost = cut != null ? all[cut] : null;
    if (before && miss.delayThatDay > 0) story.push(t("storyLateInto", legName(before), miss.station, miss.delayThatDay));
    story.push(t("storyMissed", miss.trainName, miss.station, lost ? clock(lost.plannedDeparture) : ""));
  } else if (verdict.arrivalCanceled && last) story.push(t("storyCancelled", last.name, last.from));
  if (cut != null && !(sim.legs || []).length) story.push(t("storyUnknown"));
  else if (record.actual && record.delay != null) {
    story.push(t(cut != null ? "storyOnward" : "storyArrived", record.to, clock(record.actual), record.delay));
  }
  record.story = story;
}

function applyRecord(verdict) {
  const legs = (verdict.legs || []).filter((l) => !l.walking && l.line && !NOT_TRACKED.has(l.line.product));
  if (!legs.length) return;
  const first = legs[0], last = legs[legs.length - 1];
  const planned = last.plannedArrival;
  let actual = verdict.simulation && verdict.simulation.actualArrival;
  if (!actual && verdict.arrivalDelay != null) {
    const d = new Date(planned);
    d.setMinutes(d.getMinutes() + verdict.arrivalDelay);
    actual = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  const missed = verdict.missedTransfers || [];
  record = {
    date: first.plannedDeparture.slice(0, 10),
    from: first.origin.name, to: last.destination.name,
    planned, actual, delay: verdict.arrivalDelay,
    missedAt: missed.filter((m) => !m.canceled).map((m) => m.station).join(", "),
    legs: legs.map((l) => ({
      name: legName(l),
      from: l.origin.name, to: l.destination.name,
      dep: l.plannedDeparture.slice(11, 16), arr: l.plannedArrival.slice(11, 16),
    })),
  };
  recordJourneys(verdict);
  applyFields({
    from: record.from, to: record.to, date: record.date,
    dep: first.plannedDeparture.slice(11, 16), arr: planned.slice(11, 16),
    trains: record.legs.map((l) => l.name).filter(Boolean).join(", "),
  });
  if (actual) {
    $("f-act-date").value = actual.slice(0, 10);
    $("f-act-arr").value = actual.slice(11, 16);
  }
  $("r-delay").checked = verdict.arrivalDelay != null && verdict.arrivalDelay >= 60;
  $("r-cancel").checked = !!verdict.arrivalCanceled || missed.some((m) => m.canceled);
  // name the train that did not run: the one leaving the station where the connection fell through
  const gone = missed.filter((m) => m.canceled).map((m) => record.legs.find((l) => l.from === m.station)).filter((l) => l && l.name);
  if (!gone.length && verdict.arrivalCanceled && record.legs.length) gone.push(record.legs[record.legs.length - 1]);
  cancelledTrains = gone.filter((l) => l.name).map((l) => t("vCancelledFrom", l.name, l.from)).join(", ");
  // a connection whose train did not run was cancelled, not missed
  $("r-missed").checked = missed.some((m) => !m.canceled);
  // the trains actually ridden: the booked ones up to the break, then the onward
  // journey DelayBahn worked out; without a break, the booked ones
  const sim = verdict.simulation;
  if (actual) {
    const ridden = sim && sim.missedAtLegIndex != null
      ? (verdict.legs || []).slice(0, sim.missedAtLegIndex).concat(sim.legs || []) : verdict.legs || [];
    $("f-act-trains").value = ridden.filter((l) => !l.walking && l.line).map(legName).filter(Boolean).join(", ");
    // when the first of them left: only with a departure on record for that day
    const lead = ridden.find((l) => !l.walking && l.line), left = lead && lead.departureOnDate;
    if (left && !left.canceled && left.delayMin != null) $("f-act-dep").value = shiftClock(lead.plannedDeparture, left.delayMin);
  }
  if (record.missedAt) $("f-missed-at").value = record.missedAt;
  renderDelay();
  // drawn only when the rows name exactly the trains the form will
  const rode = record.plan.filter((l) => !l.struck).concat(record.onward).map((l) => l.name).filter(Boolean).join(", ");
  record.whole = !actual || rode === val("f-act-trains");
  record.key = tripKey();
  renderTrip();
}

// the claim dialog (search or My trips) hands the checked journey over in
// sessionStorage: this tab only, and still there after a reload
function loadStart() {
  try {
    const raw = sessionStorage.getItem("claimJourney");
    if (raw) applyRecord(JSON.parse(raw));
  } catch (e) { /* no handover: the page asks for the check first */ }
}

// --- extra costs ---

const COST_KINDS = ["costHotel", "costTaxi", "costTransport", "costFood", "costOther"];

// `from` is a cost brought back after the login; a click on the button brings none
function addCost(from) {
  const cost = { kind: COST_KINDS[0], amount: "", file: null };
  costs.push(cost);
  const row = document.createElement("div");
  row.className = "claim-cost";

  const kind = document.createElement("select");
  kind.setAttribute("aria-label", t("costKind"));
  COST_KINDS.forEach((key) => kind.append(new Option(t(key), key)));
  kind.addEventListener("change", () => { cost.kind = kind.value; packet = null; });

  const amount = document.createElement("input");
  amount.type = "text";
  amount.inputMode = "decimal";
  amount.placeholder = t("costAmount");
  amount.setAttribute("aria-label", t("costAmount"));
  amount.addEventListener("input", () => { cost.amount = amount.value; packet = null; });

  const pick = document.createElement("label");
  pick.className = "claim-ghost claim-cost-file";
  const pickText = document.createElement("span");
  pickText.textContent = t("costReceipt");
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "application/pdf,image/jpeg,image/png";
  file.className = "claim-file";
  const name = document.createElement("span");
  name.className = "claim-cost-name";
  file.addEventListener("change", () => {
    const chosen = file.files[0];
    if (!chosen) return;
    if (!checkFile(chosen, "step2-error")) { file.value = ""; return; }
    cost.file = chosen;
    packet = null;
    name.textContent = chosen.name;
    pickText.textContent = t("costReceiptChange");
  });
  pick.append(file, pickText);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "claim-cost-remove";
  remove.textContent = "✕";
  remove.title = t("costRemove");
  remove.setAttribute("aria-label", t("costRemove"));
  remove.addEventListener("click", () => {
    costs = costs.filter((c) => c !== cost);
    packet = null;
    row.remove();
  });

  const main = document.createElement("div");
  main.className = "claim-cost-main";
  main.append(kind, amount, remove);
  const receipt = document.createElement("div");
  receipt.className = "claim-cost-receipt";
  receipt.append(pick, name);
  row.append(main, receipt);
  $("cost-rows").append(row);
  if (from && from.kind) {
    cost.kind = kind.value = from.kind;
    cost.amount = amount.value = from.amount || "";
    if (from.file) {
      cost.file = from.file;
      name.textContent = from.file.name;
      pickText.textContent = t("costReceiptChange");
    }
    return;
  }
  amount.focus();
}

// --- checks before a stop lets the visitor on ---

function ibanValid(raw) {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => c.charCodeAt(0) - 55);
  let rem = 0;
  for (const ch of digits) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1;
}

const payout = () => document.querySelector('input[name="payout"]:checked').value;

// the first of these fields that is still empty, top to bottom as they stand on the page
const firstEmpty = (ids) => { const id = ids.find((f) => !val(f)); return id ? { field: id } : null; };

/* What stops the step: a message key, or { field } for the topmost field
   still to fill - optionally with a key of its own when it is filled wrongly. */
function validate(from) {
  if (from === 1) {
    if (!ticket) return "needTicket";
    const gap = firstEmpty(["f-booking", "f-from", "f-to", "f-date", "f-dep", "f-arr"]);
    if (gap) return gap;
    if (!$("r-delay").checked && !$("r-cancel").checked && !$("r-missed").checked) return "needReason";
    if (!refunding()) return firstEmpty(["f-act-date", "f-act-arr"]);
  }
  if (from === 2) {
    if (costs.some((c) => !(num(c.amount) > 0))) return "needCost";
    if (costs.some((c) => !c.file)) return "needReceipt";
  }
  if (from === 3) {
    const gap = firstEmpty(["f-first", "f-last", "f-street", "f-zip", "f-city", "f-country", "f-email"]);
    if (gap) return gap;
    if (!/^\S+@\S+\.\S+$/.test(val("f-email"))) return { field: "f-email", key: "needEmail" };
    if (payout() === "money") {
      if (!val("f-iban")) return { field: "f-iban" };
      if (!ibanValid(val("f-iban"))) return { field: "f-iban", key: "needIban" };
      if (!val("f-holder")) return { field: "f-holder" };
    }
  }
  return null;
}

// the complaint in words, with the field it is about marked and in reach
function complain(problem) {
  document.querySelectorAll(".claim-missing").forEach((l) => l.classList.remove("claim-missing"));
  if (typeof problem === "string") return t(problem);
  const input = $(problem.field), label = input.closest("label");
  label.classList.add("claim-missing");
  input.addEventListener("input", () => label.classList.remove("claim-missing"), { once: true });
  input.focus({ preventScroll: true });
  input.scrollIntoView({ block: "center", behavior: "smooth" });
  return problem.key ? t(problem.key) : t("needField", label.querySelector("span").textContent.replace(/\s*\(.*\)/, ""));
}

// --- the packet: form, record, ticket, receipts in one PDF ---

// the form's standard font only knows Latin-1: anything else would abort the fill
const latin = (s) => String(s || "").normalize("NFC").replace(/[‐-―]/g, "-")
  .replace(/[‘’]/g, "'").replace(/[“”„]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "?");

async function attach(PDFLib, doc, file, sheets, label) {
  const bytes = await file.arrayBuffer();
  const kind = fileKind(file);
  if (kind === "pdf") {
    const src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await doc.copyPages(src, src.getPageIndices());
    pages.forEach((p) => { doc.addPage(p); sheets.push(label); });
    return;
  }
  const image = kind === "png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  const page = doc.addPage([595.28, 841.89]);
  const fit = image.scaleToFit(595.28 - 72, 841.89 - 72);
  page.drawImage(image, {
    x: (595.28 - fit.width) / 2, y: 841.89 - 36 - fit.height, width: fit.width, height: fit.height,
  });
  sheets.push(label);
}

// the logo is a large file: the page needs a fraction of it
const logoBytes = once(async () => {
  const image = await createImageBitmap(await (await fetch("/logo.png")).blob());
  const canvas = document.createElement("canvas");
  canvas.width = 340;
  canvas.height = Math.round(340 * image.height / image.width);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((done) => canvas.toBlob(done, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
});

// DelayBahn's own page in the packet: the journey as booked, and as it was travelled
async function recordPage(PDFLib, doc) {
  const { StandardFonts, rgb } = PDFLib;
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]);
  const ink = rgb(0.157, 0.176, 0.216), muted = rgb(0.39, 0.41, 0.45), rule = rgb(0.82, 0.84, 0.87), wash = rgb(0.95, 0.96, 0.97);
  const LEFT = 56, WIDTH = 483;
  let y = 772;
  // text that would run into the next column is cut, never overprinted
  const fit = (text, face, size, max) => {
    let out = latin(text);
    while (out.length > 4 && face.widthOfTextAtSize(out, size) > max) out = out.slice(0, -4) + "...";
    return out;
  };
  const line = (text, opts = {}) => {
    const face = opts.bold ? bold : font, size = opts.size || 10;
    page.drawText(fit(text, face, size, opts.max || WIDTH), { x: opts.x || LEFT, y, size, font: face, color: opts.muted ? muted : ink });
  };
  const hair = () => page.drawLine({ start: { x: LEFT, y }, end: { x: LEFT + WIDTH, y }, thickness: 0.6, color: rule });

  try {
    const logo = await doc.embedPng(await logoBytes());
    const w = 78, h = w * logo.height / logo.width;
    page.drawImage(logo, { x: LEFT + WIDTH - w, y: 800 - h, width: w, height: h });
  } catch (e) { /* the page stands without the logo */ }

  line(t("recordTitle"), { size: 20, bold: true });
  y -= 20;
  line(t("recordLead"), { muted: true, size: 9.5, max: WIDTH - 96 });
  y -= 38;
  line(`${record.from}  –  ${record.to}`, { size: 14, bold: true });
  y -= 17;
  line(dmy(record.date), { muted: true });

  // the three facts the claim rests on
  y -= 24;
  page.drawRectangle({ x: LEFT, y: y - 46, width: WIDTH, height: 58, color: wash });
  const stamp = (iso) => `${dmy(iso.slice(0, 10))}  ${iso.slice(11, 16)}`;
  const facts = [[t("recordPlanned"), stamp(record.planned)]];
  if (record.actual) facts.push([t("recordActual"), stamp(record.actual)]);
  if (record.delay != null) facts.push([t("recordDelay"), `${record.delay} min`]);
  facts.forEach(([label, value], i) => {
    const x = LEFT + 14 + i * 160;
    y -= 6;
    line(label, { x, muted: true, size: 9, max: 150 });
    y -= 18;
    line(value, { x, bold: true, size: 13, max: 150 });
    y += 24;
  });
  y -= 46;

  const heading = (text) => { y -= 30; line(text, { bold: true, size: 12 }); y -= 16; };
  if (record.story && record.story.length) {
    heading(t("recordStory"));
    // one sentence per line, wrapped at the page width
    record.story.forEach((sentence) => {
      let row = "";
      latin(sentence).split(" ").forEach((word) => {
        const next = row ? `${row} ${word}` : word;
        if (font.widthOfTextAtSize(next, 10.5) > WIDTH) { line(row, { size: 10.5 }); y -= 15; row = word; } else row = next;
      });
      line(row, { size: 10.5 });
      y -= 15;
    });
    y += 15;
  }

  const COLS = [[0, 78], [84, 138], [228, 138], [372, 111]];
  const table = (title, heads, rows) => {
    if (!rows || !rows.length) return;
    heading(title);
    heads.forEach((head, i) => line(head, { x: LEFT + COLS[i][0], muted: true, size: 8.5, max: COLS[i][1] }));
    y -= 7;
    hair();
    rows.forEach((row) => {
      y -= 15;
      [row.name, row.from, row.to, row.status].forEach((cell, i) => line(cell, { x: LEFT + COLS[i][0], size: 10, bold: i === 0 || i === 3, max: COLS[i][1] }));
      y -= 7;
      hair();
    });
  };
  table(t("recordBooked"), [t("recColTrain"), t("recColDep"), t("recColArr"), t("recColStatus")], record.booked);
  table(t(record.rerouted ? "recordTravelled" : "recordRan"), [t("recColTrain"), t("recColDepReal"), t("recColArrReal"), t("recColDelay")], record.travelled);

  y = 56;
  line(t("recordFoot"), { muted: true, size: 9 });
}

async function buildPacket() {
  const { PDFLib } = await loadLibs();
  const doc = await PDFLib.PDFDocument.load(await formBytes());
  const form = doc.getForm();
  const fields = form.getFields();
  if (fields.length !== FORM_FIELDS) throw new Error("unexpected form layout");
  const text = (key, value) => {
    const field = fields[F[key]];
    const max = field.getMaxLength();
    const clean = latin(value);
    field.setText(max ? clean.slice(0, max) : clean);
  };
  const tick = (key, on) => { if (on) fields[F[key]].check(); };

  const refund = refunding();
  const mins = refund ? null : delayMinutes();
  const { pct, extra } = amounts();
  tick("delay", $("r-delay").checked);
  tick("cancel", $("r-cancel").checked);
  tick("missed", $("r-missed").checked);
  text("operator", val("f-operator"));
  text("date", dmy(val("f-date")));
  text("from", val("f-from"));
  text("to", val("f-to"));
  text("dep", val("f-dep"));
  text("arr", val("f-arr"));
  text("trains", val("f-trains"));
  text("booking", val("f-booking"));
  const price = num(val("f-price"));
  text("price", price != null ? `${price.toFixed(2).replace(".", ",")} EUR` : "");
  if (!refund) {
    text("actDate", dmy(val("f-act-date")));
    text("actDep", val("f-act-dep"));
    text("actArr", val("f-act-arr"));
    text("actTrains", val("f-act-trains"));
  }
  if ($("r-missed").checked) text("missedAt", val("f-missed-at"));
  tick("refund", refund);
  tick("compensation", pct > 0);
  tick("late60", pct === 25);
  tick("late120", pct === 50);
  tick("costs", costs.length > 0);
  text("first", val("f-first"));
  text("last", val("f-last"));
  text("street", val("f-street"));
  text("house", val("f-house"));
  text("country", val("f-country"));
  text("zip", val("f-zip"));
  text("city", val("f-city"));
  text("email", val("f-email"));
  text("phone", val("f-phone"));
  const money = payout() === "money";
  tick("money", money);
  tick("voucher", !money);
  if (money) {
    text("iban", val("f-iban").replace(/\s+/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim());
    text("bic", val("f-bic").toUpperCase());
    text("holder", val("f-holder"));
  }
  const info = [];
  if (mins != null && mins > 0) info.push(`${t("recordDelay")}: ${mins} min`);
  if (costs.length) {
    info.push(`${t("costsInfo")}: ${costs.map((c) => `${t(c.kind)} ${num(c.amount).toFixed(2).replace(".", ",")} EUR`).join("; ")} (${extra.toFixed(2).replace(".", ",")} EUR)`);
  }
  text("info", info.join("\n"));
  tick("shareYes", $("share-ok").checked);
  tick("shareNo", !$("share-ok").checked);
  text("today", dmy(today()));
  text("place", val("f-city"));
  text("signer", `${val("f-first")} ${val("f-last")}`);
  // fixed print, so the packet reads the same in every mail client and viewer
  form.flatten();

  const formPages = doc.getPageCount();
  const sheets = Array.from({ length: formPages }, (_, i) => t("sheetForm", i + 1, formPages));
  // the review shows one stack per document, whatever its page count
  const groups = [{ label: t("sheetFormAll"), from: 0, count: formPages }];
  const group = async (label, add) => {
    const from = sheets.length;
    await add();
    groups.push({ label, from, count: sheets.length - from });
  };
  if (record) await group(t("sheetRecord"), async () => { await recordPage(PDFLib, doc); sheets.push(t("sheetRecord")); });
  if (ticket) await group(t("sheetTicket"), () => attach(PDFLib, doc, ticket.file, sheets, t("sheetTicket")));
  for (const cost of costs) {
    const label = t("sheetReceipt", t(cost.kind));
    if (cost.file) await group(label, () => attach(PDFLib, doc, cost.file, sheets, label));
  }
  doc.setTitle(DB_SUBJECT);
  return { bytes: await doc.save(), sheets, groups };
}

// the frames of the documents to come, shown while the packet is built
function waitingSheets() {
  const labels = [[t("sheetFormAll"), true]];
  if (record) labels.push([t("sheetRecord")]);
  if (ticket) labels.push([t("sheetTicket")]);
  costs.forEach((cost) => { if (cost.file) labels.push([t("sheetReceipt", t(cost.kind))]); });
  $("review-sheets").replaceChildren(...labels.map(([text, stack]) => {
    const sheet = document.createElement("div");
    sheet.className = "claim-sheet claim-sheet-wait" + (stack ? " claim-sheet-stack" : "");
    const cover = document.createElement("span");
    cover.className = "claim-sheet-page";
    const label = document.createElement("span");
    label.className = "claim-sheet-label";
    label.textContent = text;
    sheet.append(cover, label);
    return sheet;
  }));
}

async function renderSheets() {
  const { pdfjs } = await loadLibs();
  const worker = await previewWorker().catch(() => null);
  const pdf = await pdfjs.getDocument({ data: packet.bytes.slice(), isEvalSupported: false, ...(worker ? { worker } : {}) }).promise;
  viewer = { pdf, at: 0 };
  const groups = packet.groups.filter((group) => group.count);
  // all covers are drawn together and swapped in at once
  const covers = await Promise.all(groups.map((group) => drawSheet(pdf, group.from + 1, 0.6)));
  const sheets = [];
  groups.forEach((group, i) => {
    const sheet = document.createElement("button");
    sheet.type = "button";
    sheet.className = "claim-sheet" + (group.count > 1 ? " claim-sheet-stack" : "");
    const label = document.createElement("span");
    label.className = "claim-sheet-label";
    label.textContent = group.label;
    const cover = document.createElement("span");
    cover.className = "claim-sheet-page";
    cover.append(covers[i]);
    sheet.append(cover, label);
    if (group.count > 1) {
      const count = document.createElement("span");
      count.className = "claim-sheet-count";
      count.textContent = t("sheetPages", group.count);
      sheet.append(count);
    }
    sheet.addEventListener("click", async () => {
      await showSheet(group.from + 1);
      $("sheet-view").showModal();
    });
    sheets.push(sheet);
  });
  $("review-sheets").replaceChildren(...sheets);
}

async function drawSheet(pdf, p, scale) {
  const page = await pdf.getPage(p);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return canvas;
}

// the large view walks the whole packet, page by page, in the order DB gets it
async function showSheet(p) {
  if (!viewer || p < 1 || p > viewer.pdf.numPages) return;
  const { pdf } = viewer;
  viewer.at = p;
  $("sheet-caption").textContent = packet.sheets[p - 1] || "";
  $("sheet-count").textContent = `${p} / ${pdf.numPages}`;
  $("sheet-prev").disabled = p === 1;
  // a button that just switched off would swallow the arrow keys: hand the focus on
  const stuck = [["sheet-prev", "sheet-next"], ["sheet-next", "sheet-prev"]].find(([id]) => document.activeElement === $(id));
  $("sheet-next").disabled = p === pdf.numPages;
  if (stuck && $(stuck[0]).disabled) $(stuck[1]).focus();
  const canvas = await drawSheet(pdf, p, Math.min(2, window.devicePixelRatio > 1 ? 2 : 1.6));
  // a quicker tap may have moved on while this page was drawn
  if (!viewer || viewer.pdf !== pdf || viewer.at !== p) return;
  $("sheet-view-body").replaceChildren(canvas);
  $("sheet-view-body").scrollTop = 0;
}

function renderSum() {
  const a = amounts();
  const el = $("review-amount");
  el.textContent = "";
  const big = document.createElement("strong");
  big.textContent = t("sumLine", euro(a.total));
  const note = document.createElement("span");
  note.textContent = noteText(a);
  el.append(big, note);
}

/* `keep` is the rebuild after the data-sharing box changed: the page on
   screen is the same review, so the visitor's own confirmation stays. */
async function enterReview(keep) {
  if (!keep) $("review-ok").checked = false;
  $("next-4").disabled = true;
  renderSum();
  if (packet) return;
  waitingSheets();
  setStatus("review-status", t("reviewBuilding"));
  try {
    packet = await buildPacket();
    await renderSheets();
    setStatus("review-status", "");
    $("next-4").disabled = !$("review-ok").checked;
    track("claim-built");
  } catch (e) {
    packet = null;
    $("review-sheets").textContent = "";
    setStatus("review-status", t("reviewFailed"), true);
  }
}

// --- sending: the visitor's own mailbox ---

const packetName = () => `Fahrgastrechte-Antrag-${val("f-booking").replace(/\W/g, "") || "DB"}.pdf`;
const packetFile = () => new File([packet.bytes], packetName(), { type: "application/pdf" });

/* The send page asks for one thing at a time: the step that is next carries
   the red button, the ones behind it are ticked off, the ones ahead wait. */
let sendAt = 1;
function sendStage(to) {
  sendAt = Math.max(sendAt, to);
  [["send-download", 1], ["send-mail", 2], ["send-done", 4]].forEach(([id, stage]) => {
    $(id).classList.toggle("report-submit", stage === sendAt);
    $(id).classList.toggle("claim-ghost", stage !== sendAt);
  });
  document.querySelectorAll("#send-steps li").forEach((li) => {
    li.classList.toggle("done", Number(li.dataset.stage) < sendAt);
    li.classList.toggle("current", Number(li.dataset.stage) === sendAt);
  });
  // nothing to mail or tick off before the claim has been downloaded
  const held = sendAt < 2;
  $("send-copy").disabled = held;
  $("send-attached").disabled = held;
  $("send-mail").setAttribute("aria-disabled", String(held));
}

function enterSend() {
  gateAsked = false;
  renderGate();
  // fetched now, so the picture is there the moment the last page opens
  if (!$("done-art").getAttribute("src")) {
    $("done-art").src = `/claim/${ART[Math.floor(Math.random() * ART.length)]}.svg?v=1`;
    $("done-art").alt = t("doneArt");
  }
  // every visit to this step starts at the download: the claim may have been rebuilt since
  sendAt = 1;
  $("send-address").textContent = DB_ADDRESS;
  $("send-subject").textContent = DB_SUBJECT;
  const body = t("mailBody", `${val("f-first")} ${val("f-last")}`, val("f-booking"));
  $("send-body").textContent = body;
  $("send-attached").checked = false;
  $("send-done").disabled = true;
  $("send-mail").href = `mailto:${DB_ADDRESS}?subject=${encodeURIComponent(DB_SUBJECT)}&body=${encodeURIComponent(body)}`;
  /* Phones send like desktops: the mail link fills in recipient, subject and
     text, and the visitor attaches the download. The share sheet could attach
     the file, but on real phones it lost the subject (Apple Mail), the line
     breaks (Gmail) and always the recipient. */
  $("send-attach-note").textContent = t("sendAttachNote", packetName());
  sendStage(1);
}

function download() {
  if (!me) return;
  const url = URL.createObjectURL(packetFile());
  const a = document.createElement("a");
  a.href = url;
  a.download = packetName();
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  track("claim-download");
}

/* The feedback ask of the connection search, one per page of the claim: a
   vote, then an optional comment under the same id so the two land as one
   row. No page screenshot here - this page shows the visitor's name, address
   and bank account. A failed send is swallowed. */
let feedbackSid = "", feedbackOff = false;
function feedbackFor(context) {
  const box = $("feedback-nudge");
  if (feedbackOff || box.dataset.context === context) return;
  box.dataset.context = context;
  // under the steps the question stands below the card; on the last page it is part of it
  (context === "claim-done" ? $("claim-done") : document.querySelector(".claim-main")).append(box);
  delete box.dataset.vote;
  feedbackSid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  box.classList.remove("hidden", "feedback-voted", "feedback-done");
  $("feedback-form").classList.add("hidden");
  $("feedback-text").value = "";
  $("feedback-lead").textContent = t(context === "claim-done" ? "feedbackAskDone" : "feedbackAsk");
}

async function feedbackSend(vote, text) {
  try {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sid: feedbackSid, vote, text, shot: "", lang, context: $("feedback-nudge").dataset.context }),
    });
  } catch (e) { /* swallowed by design */ }
}

function wireFeedback() {
  const box = $("feedback-nudge");
  box.querySelectorAll(".feedback-vote").forEach((button) => button.addEventListener("click", () => {
    box.dataset.vote = button.dataset.vote;
    track(`feedback-${button.dataset.vote}`);
    feedbackSend(button.dataset.vote, "");
    $("feedback-lead").textContent = t("feedbackFollowUp");
    box.classList.add("feedback-voted");
    $("feedback-form").classList.remove("hidden");
    $("feedback-text").focus();
  }));
  $("feedback-text").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) $("feedback-form").requestSubmit();
  });
  $("feedback-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = val("feedback-text");
    if (text) {
      track("feedback-text", { vote: box.dataset.vote });
      feedbackSend(box.dataset.vote, text);
    }
    $("feedback-lead").textContent = t("feedbackThanks");
    $("feedback-form").classList.add("hidden");
    box.classList.add("feedback-done");
  });
  $("feedback-skip").addEventListener("click", () => {
    track("feedback-dismiss");
    feedbackOff = true;
    box.classList.add("hidden");
  });
}

// the message a visitor sends on: what they claimed, and where the friend can do the same
const REFER_URL = lang === "en" ? "https://delaybahn.com/en/" : "https://delaybahn.com";
function referMessage() {
  const total = amounts().total;
  const text = t("referText", total > 0 ? euro(total) : "");
  return { text, full: `${text} ${t("referTry")} ${REFER_URL}` };
}

function renderRefer() {
  const { text, full } = referMessage();
  const enc = encodeURIComponent;
  // a phone's share sheet already lists every app; WhatsApp stays beside it as the one-tap way
  const sheet = !!navigator.share && matchMedia("(pointer: coarse)").matches;
  $("done-refer").classList.toggle("hidden", !sheet);
  ["refer-mail", "refer-telegram", "refer-copy"].forEach((id) => $(id).classList.toggle("hidden", sheet));
  $("refer-whatsapp").href = `https://wa.me/?text=${enc(full)}`;
  $("refer-mail").href = `mailto:?subject=${enc(t("referSubject"))}&body=${enc(full)}`;
  $("refer-telegram").href = `https://t.me/share/url?url=${enc(REFER_URL)}&text=${enc(text)}`;
}

// one burst of paper over the last page, then the canvas is gone again
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.className = "claim-confetti";
  canvas.setAttribute("aria-hidden", "true");
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = w * ratio;
  canvas.height = h * ratio;
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  const colours = ["#ff1f1f", "#1f7a3a", "#f5b301", "#2f6fde", "#ff8a5c"];
  const count = Math.min(140, Math.round(w / 7));
  const bits = Array.from({ length: count }, (_, i) => {
    // two fans, from the lower left and the lower right, up and towards the middle
    const left = i % 2 === 0;
    const angle = (left ? -Math.PI / 3 : -2 * Math.PI / 3) + (Math.random() - 0.5) * 0.9;
    const speed = (0.55 + Math.random() * 0.6) * Math.min(h, 900) / 46;
    return {
      x: left ? -10 : w + 10, y: h * 0.72, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      size: 6 + Math.random() * 6, spin: Math.random() * Math.PI, turn: (Math.random() - 0.5) * 0.4,
      colour: colours[i % colours.length],
    };
  });
  const start = performance.now();
  const LIFE = 2800;
  (function frame(now) {
    const age = now - start;
    ctx.clearRect(0, 0, w, h);
    if (age > LIFE) { canvas.remove(); return; }
    ctx.globalAlpha = age > LIFE - 600 ? (LIFE - age) / 600 : 1;
    for (const b of bits) {
      b.vy += 0.32;
      b.vx *= 0.985;
      b.x += b.vx;
      b.y += b.vy;
      b.spin += b.turn;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.spin);
      ctx.fillStyle = b.colour;
      // a strip seen from the side gets thin: that is the flutter
      ctx.fillRect(-b.size / 2, -b.size / 4 * Math.abs(Math.cos(b.spin * 2)) - 1, b.size, b.size / 2 * Math.abs(Math.cos(b.spin * 2)) + 2);
      ctx.restore();
    }
    requestAnimationFrame(frame);
  })(start);
}

function showDone() {
  if (draftWaiting()) takeDraft();
  confetti();
  renderRefer();
  const a = amounts();
  feedbackFor("claim-done");
  document.querySelectorAll("[data-panel]").forEach((p) => p.classList.add("hidden"));
  $("claim-line").classList.add("claim-line-done");
  document.querySelectorAll(".claim-stop").forEach((s) => { s.classList.add("done"); s.classList.remove("current"); });
  $("done-amount").textContent = t("doneAmount", euro(a.total));
  $("done-note").textContent = noteText(a);
  $("done-lead").textContent = t(payout() === "money" ? "doneLead" : "doneLeadVoucher");
  $("claim-done").classList.remove("hidden");
  $("claim-done").scrollIntoView({ block: "start", behavior: "smooth" });
  track("claim-sent");
}

// --- moving along the line ---

function go(to) {
  if (to > step) {
    for (let s = step; s < to; s++) {
      const problem = validate(s);
      if (problem) {
        if (s !== step) show(s);
        // the complaint is about something folded away: bring it into view
        if (problem.field === "f-booking") $("ticket-fields").classList.remove("hidden");
        else if (s === 1 && problem !== "needTicket") $("journey-edit").open = true;
        setStatus(`step${s}-error`, complain(problem), true);
        return;
      }
      setStatus(`step${s}-error`, "");
    }
    if (step <= 3 && to > 3) keepDetails();
  }
  show(to);
}

function show(to, first) {
  step = to;
  feedbackFor(`claim-${to}`);
  // each stop is counted once, the first time the visitor gets there
  if (to > reached) track("claim-step", { step: to });
  reached = Math.max(reached, to);
  if (to === 2 || to === 3) warm();
  // stepping back in from the last page puts that page away again
  $("claim-done").classList.add("hidden");
  $("claim-line").classList.remove("claim-line-done");
  document.querySelectorAll("[data-panel]").forEach((p) => {
    p.classList.toggle("hidden", Number(p.dataset.panel) !== step);
  });
  document.querySelectorAll(".claim-stop").forEach((s) => {
    const n = Number(s.dataset.step);
    s.classList.toggle("current", n === step);
    s.classList.toggle("done", n < step);
    s.querySelector("button").disabled = n > reached;
    if (n === step) s.querySelector("button").setAttribute("aria-current", "step");
    else s.querySelector("button").removeAttribute("aria-current");
  });
  if (step === 4) enterReview();
  if (step === 5) enterSend();
  if (!first) $("claim-line").scrollIntoView({ block: "start", behavior: "smooth" });
}

function applyStatic() {
  document.documentElement.lang = lang;
  document.title = t("docTitle");
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const text = I18N[lang][node.dataset.i18n];
    if (typeof text === "string") node.textContent = text;
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAria));
    if (node.classList.contains("feedback-vote") || node.classList.contains("feedback-skip")) node.title = t(node.dataset.i18nAria);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  document.querySelectorAll(".lang-btn").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
  $("auth-login").href = LOGIN;
  $("photo-login-link").href = LOGIN;
  $("gate-login").href = LOGIN;
  ["auth-login", "photo-login-link", "gate-login"].forEach(keepThroughLogin);
  $("auth-name").href = TRIPS;
  $("done-trips").href = TRIPS;
  $("claim-start-go").href = CHECK;
  if (lang === "en") $("f-country").value = "Germany";
}

function wire() {
  $("ticket-file").addEventListener("change", (e) => onTicket(e.target.files[0]));
  const drop = $("ticket-drop");
  ["dragenter", "dragover"].forEach((type) => drop.addEventListener(type, (e) => {
    e.preventDefault();
    drop.classList.add("claim-drop-over");
  }));
  ["dragleave", "drop"].forEach((type) => drop.addEventListener(type, (e) => {
    e.preventDefault();
    drop.classList.remove("claim-drop-over");
  }));
  drop.addEventListener("drop", (e) => onTicket(e.dataTransfer.files[0]));
  $("photo-read").addEventListener("click", readPhoto);
  $("photo-skip").addEventListener("click", () => {
    $("photo-consent").classList.add("hidden");
    askTicketGaps();
    $("f-booking").focus();
  });
  $("journey-edit").addEventListener("input", renderDelay);
  $("ticket-fields").addEventListener("input", renderDelay);
  $("r-refund").addEventListener("input", renderDelay);
  // any edit makes the built packet stale, and answers the complaint above the button
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.addEventListener("input", () => {
      if (panel.dataset.panel !== "4") packet = null;
      setStatus(`step${panel.dataset.panel}-error`, "");
    });
  });
  document.querySelectorAll('input[name="payout"]').forEach((radio) => radio.addEventListener("change", () => {
    $("bank-fields").classList.toggle("hidden", payout() !== "money");
  }));
  $("cost-add").addEventListener("click", addCost);
  // the reimbursement hint: pointing at, tabbing to or tapping an icon says when it applies
  // a German postal code names its town: the table is a file of this site, so the
  // code is looked up on the device and never sent anywhere
  let plz = null, cityAuto = "";
  $("f-zip").addEventListener("input", async () => {
    const code = val("f-zip");
    if (!/^\d{5}$/.test(code)) return;
    try {
      plz = plz || fetch("/claim/plz-de.json").then((r) => (r.ok ? r.json() : {}));
      const hit = (await plz)[code];
      if (val("f-zip") !== code) return;
      const names = hit ? [].concat(hit) : [];
      $("city-options").replaceChildren(...names.map((name) => Object.assign(document.createElement("option"), { value: name })));
      // only over an empty field or the town this lookup put there itself, which
      // a new code also takes away again
      if (!val("f-city") || val("f-city") === cityAuto) $("f-city").value = cityAuto = names.length === 1 ? names[0] : "";
      if (hit) $("f-country").value = lang === "en" ? "Germany" : "Deutschland";
    } catch (e) {
      plz = null;
    }
  });
  const hintItems = [...document.querySelectorAll(".claim-hint-item")];
  const hintShow = (item) => {
    hintItems.forEach((other) => other.classList.toggle("on", other === item));
    $("hint-text").textContent = t(item ? item.dataset.hint : "costsHintNote");
  };
  hintItems.forEach((item) => {
    ["mouseenter", "focus", "click"].forEach((type) => item.addEventListener(type, () => hintShow(item)));
  });
  $("hint-items").addEventListener("mouseleave", () => hintShow(hintItems.find((item) => item === document.activeElement) || null));
  $("hint-items").addEventListener("focusout", (e) => { if (!$("hint-items").contains(e.relatedTarget)) hintShow(null); });
  document.querySelectorAll("[data-next]").forEach((button) => {
    button.addEventListener("click", () => go(Number(button.dataset.next)));
  });
  document.querySelectorAll(".claim-stop-btn").forEach((button) => {
    button.addEventListener("click", () => go(Number(button.parentElement.dataset.step)));
  });
  $("review-ok").addEventListener("change", () => { $("next-4").disabled = !($("review-ok").checked && packet); });
  // the box is a tick on the form itself: the pages are made again with it
  $("share-ok").addEventListener("change", () => { packet = null; enterReview(true); });
  $("sheet-close").addEventListener("click", () => $("sheet-view").close());
  $("sheet-prev").addEventListener("click", () => showSheet(viewer.at - 1));
  $("sheet-next").addEventListener("click", () => showSheet(viewer.at + 1));
  $("sheet-view").addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") showSheet(viewer.at - 1);
    if (e.key === "ArrowRight") showSheet(viewer.at + 1);
  });
  $("sheet-view").addEventListener("click", (e) => { if (e.target === $("sheet-view")) $("sheet-view").close(); });
  $("send-download").addEventListener("click", () => {
    if (!me) { gateAsked = true; renderGate(); track("claim-gate"); return; }
    download();
    sendStage(2);
  });
  // each part of the email copies on its own; the button at the top copies the message text
  document.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", async () => {
    // the email itself only unfolds for someone who wants to copy it
    if (button.id === "send-copy") $("send-card").classList.add("open");
    const part = { to: DB_ADDRESS, subject: DB_SUBJECT, body: $("send-body").textContent };
    const text = part[button.dataset.copy];
    try {
      await navigator.clipboard.writeText(text);
      button.classList.add("copied");
      if (button.id === "send-copy") button.textContent = t("sendCopied");
      setTimeout(() => {
        button.classList.remove("copied");
        if (button.id === "send-copy") button.textContent = t("sendCopy");
      }, 1600);
      sendStage(3);
    } catch (e) { /* the text is on the page and can be selected by hand */ }
  }));
  $("send-mail").addEventListener("click", (e) => {
    if (sendAt < 2) { e.preventDefault(); return; }
    track("claim-mail");
    sendStage(3);
  });
  $("send-attached").addEventListener("change", () => {
    $("send-done").disabled = !$("send-attached").checked;
    if ($("send-attached").checked) sendStage(4);
  });
  $("send-done").addEventListener("click", showDone);
  // phones hand the message to the share sheet; the row of targets is plain links, no third-party script
  $("done-refer").addEventListener("click", async () => {
    track("claim-refer", { via: "sheet" });
    try { await navigator.share({ text: referMessage().full }); } catch (e) { /* the share sheet was closed */ }
  });
  ["whatsapp", "mail", "telegram"].forEach((via) => $(`refer-${via}`).addEventListener("click", () => track("claim-refer", { via })));
  $("refer-copy").addEventListener("click", async () => {
    track("claim-refer", { via: "copy" });
    try {
      await navigator.clipboard.writeText(referMessage().full);
      setStatus("refer-status", t("referCopied"));
      setTimeout(() => setStatus("refer-status", ""), 2500);
    } catch (e) { /* the clipboard is not allowed here */ }
  });
  // no reload here: what the visitor typed into the claim stays
  $("auth-logout").addEventListener("click", async () => {
    try {
      await fb.signOut(fb.auth);
    } catch (e) { /* the SDK may still hold the user: the page treats them as signed out either way */ }
    fb.remember(false);
    dropDetails();
    me = null;
    renderAuth();
  });
  wireFeedback();
}

/* --- remembered details ---
   Name, address and payout stay in this browser for the next claim when the
   visitor ticks the box. A logout drops them: here at once, and one made on
   another page the next time this page opens - the copy notes that it was
   kept under an account, and the account hint is gone by then. */
const KEEP = "claimDetails";
const KEEP_FIELDS = ["f-first", "f-last", "f-street", "f-house", "f-zip", "f-city", "f-country", "f-email", "f-phone", "f-iban", "f-holder", "f-bic"];

function hinted() {
  try { return localStorage.getItem("account") === "1"; } catch (e) { return false; }
}

function keepDetails() {
  try {
    if (!$("keep-details").checked) { localStorage.removeItem(KEEP); return; }
    const fields = {};
    KEEP_FIELDS.forEach((id) => { fields[id] = $(id).value; });
    localStorage.setItem(KEEP, JSON.stringify({ account: hinted(), payout: payout(), fields }));
  } catch (e) { /* storage refused: the claim goes on, nothing is remembered */ }
}

function dropDetails() {
  $("keep-details").checked = false;
  try { localStorage.removeItem(KEEP); } catch (e) { /* nothing was kept */ }
}

function loadDetails() {
  let kept = null;
  try { kept = JSON.parse(localStorage.getItem(KEEP)); } catch (e) { kept = null; }
  if (!kept || !kept.fields) return;
  if (kept.account && !hinted()) { dropDetails(); return; }
  for (const [id, value] of Object.entries(kept.fields)) if (KEEP_FIELDS.includes(id) && value) $(id).value = value;
  const pay = document.querySelector(`input[name="payout"][value="${kept.payout}"]`);
  if (pay) { pay.checked = true; pay.dispatchEvent(new Event("change")); }
  $("keep-details").checked = true;
}

// a copy kept before the login now belongs to the account: its logout drops it
function adoptDetails() {
  try {
    const kept = JSON.parse(localStorage.getItem(KEEP));
    if (kept && !kept.account) localStorage.setItem(KEEP, JSON.stringify({ ...kept, account: true }));
  } catch (e) { /* nothing was kept */ }
}

/* --- the login detour ---
   Logging in leaves this page, and the page keeps nothing by itself. So the
   claim - fields, ticket, receipts - is set aside in this browser's own
   database for the way there and back: read and deleted on return, ignored
   when older than half an hour. It never leaves the device. A login that was
   given up leaves it behind: the Back button and the last page clear it here,
   the service worker (sweepClaimDraft in sw.js) on any later page of the site. */
const DRAFT_FLAG = "claimDraft";
const DRAFT_MAX_AGE = 30 * 60 * 1000;

function draftStore(mode, work) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("delaybahn-claim", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("draft");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("draft", mode);
      const request = work(tx.objectStore("draft"));
      tx.oncomplete = () => { db.close(); resolve(request.result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
}

// the database is only opened when a claim is known to wait in it
function draftWaiting() {
  try { return !!localStorage.getItem(DRAFT_FLAG); } catch (e) { return false; }
}

async function saveDraft() {
  const fields = {}, checks = {};
  document.querySelectorAll(".claim-main input[id]").forEach((el) => {
    if (el.type === "file") return;
    if (el.type === "checkbox") checks[el.id] = el.checked; else fields[el.id] = el.value;
  });
  const draft = {
    at: Date.now(), journey: sessionStorage.getItem("claimJourney"), fields, checks, payout: payout(),
    costs: costs.map((c) => ({ kind: c.kind, amount: c.amount, file: c.file })),
    ticket: ticket ? ticket.file : null, pending: !!pendingPhoto, step, reached,
  };
  await draftStore("readwrite", (store) => store.put(draft, "draft"));
  localStorage.setItem(DRAFT_FLAG, String(draft.at));
}

async function takeDraft() {
  try {
    localStorage.removeItem(DRAFT_FLAG);
    const draft = await draftStore("readonly", (store) => store.get("draft"));
    await draftStore("readwrite", (store) => store.delete("draft"));
    return draft || null;
  } catch (e) { return null; }
}

async function applyDraft(draft) {
  for (const [id, value] of Object.entries(draft.fields)) if ($(id)) $(id).value = value;
  for (const [id, on] of Object.entries(draft.checks)) if ($(id)) $(id).checked = on;
  const pay = document.querySelector(`input[name="payout"][value="${draft.payout}"]`);
  if (pay) { pay.checked = true; pay.dispatchEvent(new Event("change")); }
  draft.costs.forEach(addCost);
  if (draft.ticket && draft.pending) {
    // the photo was waiting for this login: ask about it again
    onTicket(draft.ticket);
  } else {
    if (draft.ticket) {
      holdTicket(draft.ticket);
      askTicketGaps();
    }
  }
  renderDelay();
  reached = Math.max(reached, draft.reached || 1);
  let to = draft.step || 1;
  if (to === 5) {
    // the send step hands out the built claim: build it again first
    try {
      packet = await buildPacket();
      await renderSheets();
    } catch (e) { packet = null; to = 4; }
  }
  if (to > 1) show(to);
}

// Back from the login page without a reload: the claim is still on screen, the copy is not needed
window.addEventListener("pageshow", (e) => { if (e.persisted && draftWaiting()) takeDraft(); });

// a login link leaves the page: the claim is set aside first
function keepThroughLogin(id) {
  $(id).addEventListener("click", async (e) => {
    if (!record) return;
    e.preventDefault();
    const href = $(id).href;
    try { await saveDraft(); } catch (err) { /* storage refused: the login still works, the claim starts over */ }
    location.assign(href);
  });
}

// everything on the page that depends on who is signed in
function renderAuth() {
  // a photo may already be waiting when the sign-in state arrives
  $("photo-login").classList.toggle("hidden", !!me);
  if (pendingPhoto || !me) $("photo-read").disabled = !me;
  $("auth-login").classList.toggle("hidden", !!me);
  $("auth-user").classList.toggle("hidden", !me);
  if (me) {
    $("auth-name-text").textContent = me.name;
    if (me.user.email && !val("f-email")) $("f-email").value = me.user.email;
    adoptDetails();
  }
  renderGate();
}

// the claim is handed out to accounts only: a download without one shows the way to the login
let gateAsked = false;
function renderGate() {
  $("send-gate").classList.toggle("hidden", !!me || !gateAsked);
  // a login in the other tab reaches this one through the listener
  if (!me && step === 5) watchAuth();
}

/* One listener for the sign-in state: it reports the account this browser
   already holds, a logout, and a login finished in another tab. */
let watching = null;
function watchAuth() {
  watching = watching || (async () => {
    fb = await import("/firebase.js?v=2");
    if (!fb.auth) { renderAuth(); return; }
    fb.onAuthStateChanged(fb.auth, async (user) => {
      let next = null;
      try {
        if (user) {
          const who = await fb.identity(user);
          if (who.verified) next = { user, name: who.name || "" };
        }
      } catch (e) { next = null; }
      me = next;
      renderAuth();
    });
  // a failed load is not retried: the gate would ask for it again on every render
  })().catch(() => { me = null; renderAuth(); });
  return watching;
}

async function init() {
  applyStatic();
  wire();
  show(1, true);
  loadDetails();
  // a claim set aside for the login comes back, unless this tab has moved on to another journey
  let saved = draftWaiting() ? await takeDraft() : null;
  let here = null;
  try { here = sessionStorage.getItem("claimJourney"); } catch (e) { here = null; }
  if (saved && (Date.now() - saved.at > DRAFT_MAX_AGE || !saved.journey || (here && here !== saved.journey))) saved = null;
  if (saved && !here) {
    try { sessionStorage.setItem("claimJourney", saved.journey); } catch (e) { saved = null; }
  }
  // the journey is already in this tab: show it before waiting for the sign-in state
  loadStart();
  track(record ? "claim-start" : "claim-no-journey");
  // no checked journey behind this visit: nothing to claim from yet
  if (!record) {
    $("feedback-nudge").classList.add("hidden");
    document.querySelectorAll("[data-panel]").forEach((p) => p.classList.add("hidden"));
    $("claim-line").classList.add("hidden");
    $("claim-start").classList.remove("hidden");
  }
  if (saved && record) await applyDraft(saved);
  else if (record) await adoptKept();
  // the SDK is only worth loading for a browser that has signed in before
  if (hinted()) watchAuth(); else renderAuth();
}

init();

})();
