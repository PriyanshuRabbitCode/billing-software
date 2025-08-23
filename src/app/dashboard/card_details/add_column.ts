// This file is used to add the card_number column to the card_details table
import { query } from "@/lib/postgres";

export async function addCardNumberColumn() {
  try {
    await query(`ALTER TABLE public.card_details ADD COLUMN IF NOT EXISTS card_number VARCHAR(20);`);
    console.log('Successfully added card_number column to card_details table');
    return { success: true };
  } catch (error) {
    console.error('Error adding card_number column:', error);
    return { success: false, error };
  }
}
