import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const customerId = formData.get('customerId') as string;
    const docType = formData.get('docType') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: 'File size exceeds 10MB limit' 
      }, { status: 400 });
    }

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ 
        error: 'Only image files are allowed' 
      }, { status: 400 });
    }

    // Generate filename: documentType_customerId.extension
    const extension = file.name.split('.').pop();
    const fileName = `${docType.toLowerCase().replace(/\s+/g, '')}_${customerId}.${extension}`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    // Convert File to Buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Return the relative path for database storage
    return NextResponse.json({ 
      path: `/data/uploads/${fileName}`,
      fileName: fileName
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: 'Error uploading file' 
    }, { status: 500 });
  }
}
