import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { z } from "zod";

const apiKey = (process.env['GEMINI_API_KEY'] || "").trim();
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
  try {
    const { message, audio, mimeType } = await req.json();

    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set in environment variables");
      return NextResponse.json({ error: "API Key missing" }, { status: 500 });
    }

    console.log(`API Key present: ${apiKey.substring(0, 10)}...`);
    console.log(`Received request with: message=${!!message}, audio=${!!audio}, mimeType=${mimeType}`);

    const modelNames = [
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-pro"
    ];

    const prompt = `
      You are a credit management assistant for Mogshops. 
      Extract debt/credit information from the provided inputs (text or audio).
      The user is a shop owner recording people who owe them money.
      
      Return a JSON object with:
      - customerName: string (The person who owes money)
      - customerContact: string (Phone number or email of the customer)
      - amountOwed: number (Total cost of items bought on credit)
      - deposited: number (Amount already paid upfront)
      - balance: number (Remaining debt: amountOwed - deposited)
      - description: string (What they bought or context)
      - date: string (ISO date if mentioned, otherwise null)
      - agreedPaymentDate: string (ISO date for when they promised to pay, or null)
      
      If a field is missing, use null or appropriate defaults.
      Format the response as a clean JSON object without markdown blocks.
      Example: "Darty bought a bag of rice for 50k and paid 20k. His number is 08012345678 and he will pay next week friday" 
      -> { "customerName": "Darty", "customerContact": "08012345678", "amountOwed": 50000, "deposited": 20000, "balance": 30000, "description": "Bag of rice", "agreedPaymentDate": "2026-05-15T00:00:00.000Z" }
    `;

    const parts: any[] = [{ text: prompt }];
    if (audio) parts.push({ inlineData: { data: audio, mimeType: mimeType || "audio/webm" } });
    if (message) parts.push({ text: `User input: "${message}"` });

    let resultText = "";
    let success = false;
    let lastError: any = null;

    for (const name of modelNames) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const model = genAI.getGenerativeModel({ model: name });
          const result = await model.generateContent(parts);
          resultText = result.response.text();
          if (resultText) { success = true; break; }
        } catch (e: any) {
          lastError = e;
          console.error(`[${name}] Attempt ${attempt + 1} failed:`, e.message);
          if (e.message?.includes("503") || e.message?.includes("overload")) {
            await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
            continue;
          }
          break;
        }
      }
      if (success) break;
    }

    // Last resort fallback: try text only if audio was present and failed
    if (!success && audio && message) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent([{ text: prompt }, { text: `User input: "${message}"` }]);
        resultText = result.response.text();
        if (resultText) success = true;
      } catch (e) {
        // ignore
      }
    }

    if (!success) {
      console.error("All models failed. Last error:", lastError?.message);
      return NextResponse.json(
        { error: "AI service failed", details: lastError?.message || "Unknown error" },
        { status: 503 }
      );
    }

    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : resultText;
    
    let rawData;
    try {
      rawData = JSON.parse(jsonString);
    } catch (e) {
      throw new Error("AI returned invalid JSON format.");
    }

    const DebtSchema = z.object({
      customerName: z.string().nullable().default("Unknown Customer"),
      customerContact: z.string().nullable().default(null),
      amountOwed: z.preprocess((val) => {
        if (typeof val === 'string') return parseFloat(val.replace(/[^\d.]/g, ''));
        return val;
      }, z.number().nullable().default(0)),
      deposited: z.preprocess((val) => {
        if (typeof val === 'string') return parseFloat(val.replace(/[^\d.]/g, ''));
        return val;
      }, z.number().nullable().default(0)),
      balance: z.preprocess((val) => {
        if (typeof val === 'string') return parseFloat(val.replace(/[^\d.]/g, ''));
        return val;
      }, z.number().nullable().default(0)),
      description: z.string().nullable().default("Credit Sale"),
      date: z.string().nullable().default(new Date().toISOString()),
      agreedPaymentDate: z.string().nullable().default(null),
    });

    const validatedData = DebtSchema.parse(rawData);

    // Recalculate balance if AI got it wrong
    if (validatedData.amountOwed && validatedData.deposited !== null) {
        validatedData.balance = validatedData.amountOwed - validatedData.deposited;
    }

    return NextResponse.json(validatedData);

  } catch (error: any) {
    return NextResponse.json({ error: "Failed to parse debt info", details: error.message }, { status: 500 });
  }
}
