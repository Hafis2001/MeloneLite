const text = `Special Shawaya
SHAWAYA QTR
SHAWAYA HALF
SHAWAYA FULL
150
300
560
Shawarma
FULL MEAT ROLL
CLASSIC ROLL
Rice
ARABIC RICE
Extra add on
KUBOOS
RUMALI ROTTI
MAYYONISE
DIPS
RAW MANGO SALAD
TEA | JUICE / SNACK.
SERVING SINCE 2020
B tandtkerala
150
120
90
10
20
10
10
50
French Fries
CLASSIC FRIES
PERI PERI`;

const prompt = `You are a menu parsing AI. The input text is OCR output from a multi-column restaurant menu.
Because of the columns, the OCR text often lists a group of item names first, followed by a group of their prices.

For example, if you see:
CategoryName
Item A
Item B
10
20
It means:
- Item A has price 10 (under CategoryName)
- Item B has price 20 (under CategoryName)

Your job:
1. Identify the category headers (like "Special Shawaya", "Shawarma", "Rice", "French Fries", "Fresh Juice", "Momos", "Extra add on").
2. Match the sequence of item names under each category header with the sequence of price numbers that follow them.
3. Ignore restaurant name, phone numbers, and social media handles.
4. Each item must have a valid 'name', numeric 'price', and 'category'.
5. DO NOT write any long reasoning, thoughts, or explanations. Keep your internal reasoning extremely brief (under 50 words) to prevent running out of output tokens. Start your response directly with the JSON object.
6. Return ONLY a valid JSON object with a key "items" containing the array of objects. Example: {"items": [{"name": "SHAWAYA QTR", "price": 150, "category": "Special Shawaya"}]}.

OCR Text to parse:
${text}`;

const url = 'https://text.pollinations.ai/' + encodeURIComponent(prompt) + '?model=openai';
console.log('Fetching:', url.slice(0, 150) + '...');

fetch(url)
  .then(async r => {
    console.log('Status:', r.status);
    const t = await r.text();
    console.log('Response:', t);
  })
  .catch(e => console.error(e));
