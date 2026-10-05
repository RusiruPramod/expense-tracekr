# 🔐 Splitly - User Authentication & Data Management Guide
**පරිශීලක පිවිසුම් සහ දත්ත කළමනාකරණ මාර්ගෝපදේශය**

Firebase හි පැවති සියලුම පැරණි ආදර්ශක දත්ත (Mock Data, Sample Expenses & Groups) සම්පූර්ණයෙන්ම ඉවත් කර (Clean/Wiped) ඇති අතර, දැන් ඕනෑම නව සාමාජිකයෙකුට (New User) තමන්ගේම සත්‍ය දත්ත ඇතුළත් කිරීමට (Real-Time Expense Tracking) ඉඩ සලසා ඇත.

---

## 🚀 නව පරිශීලකයින් සඳහා පිවිසීම (New User Registration & Login)

1. **නව ගිණුමක් සෑදීම (Sign Up):**
   - Login තිරයේ පහළ ඇති **"Sign up"** ක්ලික් කරන්න.
   - ඔබගේ නම (Full Name), විද්‍යුත් ලිපිනය (Email) සහ නව මුරපදයක් (Password) ඇතුළත් කර **Sign up** බොත්තම ඔබන්න.
   - ගිණුම සෑදූ වහාම ඔබගේ නමින් නව පිරිසිදු Expense Group එකක් ස්වයංක්‍රීයව සෑදේ (කිසිදු mock data එකක් අඩංගු නොවේ).

2. **Google මඟින් පිවිසීම (1-Click Google Sign In):**
   - **"Continue with Google"** ක්ලික් කර ඔබගේ Google ගිණුම තෝරා ක්ෂණිකව පිවිසිය හැක.

3. **සාමාන්‍ය පිවිසුම (Sign In):**
   - ඔබගේ ලියාපදිංචි ඊමේල් සහ මුරපදය ඇතුළත් කර **Sign in** වන්න.

4. **මුරපදය යළි සැකසීම (Forgot / Reset Password):**
   - මුරපදය අමතක වූ විට **"Forgot password?"** ක්ලික් කර ඊමේල් ලිපිනය ඇතුළත් කිරීමෙන් Firebase Password Reset Link එකක් ඊමේල් මඟින් ලබාගත හැක.

---

## 👥 මිතුරන් සහ වියදම් එකතු කිරීම (Adding Friends & Updating Expenses)

- **මිතුරන් එකතු කිරීම (Add Friends):**
  - **People** පිටුවට ගොස් **"+ Add Friend"** බොත්තම ඔබා ඔබගේ මිතුරන්ගේ නම් ඇතුළත් කරන්න.
- **වියදම් ඇතුළත් කිරීම (Add Expense):**
  - පහළ ඇති **"+"** (FAB) බොත්තම ඔබා ඕනෑම වියදමක් (Food, Travel, Bills ආදිය), ගෙවූ පුද්ගලයා සහ බෙදාගන්නා ආකාරය (Equal, Manual, Percent, Individual) තෝරා ඇතුළත් කරන්න.
- **ගනුදෙනු පියවීම් (Settlements):**
  - දෛනික හෝ අවසාන සාරාංශයෙන් (Summary) එක් එක් පුද්ගලයා අතර ඇති ගනුදෙනු පහසුවෙන්ම පියවිය (Settle Up) හැක.

