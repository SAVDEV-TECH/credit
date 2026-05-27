import { NextResponse } from "next/server";
import { z } from "zod";

function parseDebtFromText(input: string): Record<string, any> {
  // Patterns for merchant use: "john owe me 5000", "john owes 5k", "john 5000 paid 2000"
  
  // Extract customer name (first word, any case - capitalize first letter)
  const nameMatch = input.match(/(?:^|\b)([A-Za-z]+)(?:\s+(?:owe|owes|bought|paid|owe\s+me))?/);
  const rawName = nameMatch?.[1] || "Customer";
  // Capitalize first letter, lowercase rest
  const customerName = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();

  // Extract all amounts (handle k/thousand suffixes)
  const amountMatches = input.match(/(\d+(?:[.,]\d+)?)\s*(?:k|thousand)?/gi);
  const amounts = amountMatches?.map(a => {
    const num = parseFloat(a.replace(/[^\d.]/g, ''));
    return a.toLowerCase().includes('k') ? num * 1000 : num;
  }) || [];

  // Extract paid/deposited amount (looks for "paid X" pattern)
  const paidMatch = input.match(/(?:paid|deposited|paid\s+me)\s+(\d+(?:[.,]\d+)?)\s*(?:k|thousand)?/i);
  const deposited = paidMatch ? (
    parseFloat(paidMatch[1].replace(/[^\d.]/g, '')) * 
    (paidMatch[0].toLowerCase().includes('k') ? 1000 : 1)
  ) : (amounts[1] || 0);

  // Extract phone number (10-11 digits)
  const phoneMatch = input.match(/(\d{10,11}|0\d{10})/);
  
  // Determine amount owed (first amount in input, or second if only one amount)
  const amountOwed = amounts[0] || 0;
  
  return {
    customerName: customerName.trim(),
    amountOwed: Math.max(0, amountOwed),
    deposited: Math.max(0, deposited),
    balance: Math.max(0, (amountOwed || 0) - (deposited || 0)),
    description: input.substring(0, 50),
    date: new Date().toISOString(),
    customerContact: phoneMatch?.[0] || null,
    agreedPaymentDate: null,
  };
}

const DebtSchema = z.object({
  customerName: z.string().min(1, "Customer name required").default("Customer"),
  customerContact: z.string().nullable().default(null),
  amountOwed: z.number().min(0, "Amount must be positive").default(0),
  deposited: z.number().min(0, "Deposited must be positive").default(0),
  balance: z.number().min(0).default(0),
  description: z.string().default("Credit Sale"),
  date: z.string().default(new Date().toISOString()),
  agreedPaymentDate: z.string().nullable().default(null),
});

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    // Validate input - message is required
    if (!message?.trim()) {
      return NextResponse.json(
        { error: "Please provide debt details", details: "Example: 'john owe me 5000'" },
        { status: 400 }
      );
    }

    const userInput = message.trim();

    // Parse using regex patterns
    const parsedData = parseDebtFromText(userInput);

    // Validate with schema
    const validatedData = DebtSchema.parse(parsedData);

    return NextResponse.json(validatedData);

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid debt information", details: error.errors[0].message },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: "Failed to parse debt info", details: error.message },
      { status: 500 }
    );
  }
}
