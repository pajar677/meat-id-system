import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// Pastikan API Key diinisialisasi secara malas (lazy initialization) dan aman
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined. Silakan atur di Secrets AI Studio.");
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, mimeType } = body;

    if (!image) {
      return NextResponse.json(
        { error: "Gambar tidak ditemukan dalam riwayat input." },
        { status: 400 }
      );
    }

    // Ekstrak data base64 bersih (menghapus prefix data:image/...;base64, jika ada)
    const base64Data = image.includes(",") ? image.split(",")[1] : image;
    const finalMimeType = mimeType || "image/jpeg";

    const ai = getGeminiClient();

    const systemInstruction = `Anda adalah ahli pengolah citra makanan dan dokter gizi di "Meat Identification System".
Tugas Anda adalah menganalisis gambar daging yang diunggah dan mengklasifikasikannya ke dalam salah satu kategori berikut:
- Daging Sapi (Beef)
- Daging Ayam (Chicken)
- Daging Kambing (Goat/Mutton)
- Daging Babi (Pork)
- Daging Ikan (Fish)

Serta mengidentifikasi Tingkat Kesegaran Daging ke dalam salah satu kategori berikut:
- "Segar" (Karakteristik: Warna cerah alami, tekstur padat/kenyal, permukaan lembap tidak berlendir, tidak ada perubahan warna signifikan)
- "Kurang Segar" (Karakteristik: Warna memudar/menggelap, agak kering atau sedikit berlendir, tekstur kurang padat, ada perubahan warna setempat)
- "Busuk" (Karakteristik: Warna kusam, kehijauan/kecoklatan/kehitaman, permukaan berlendir berlebih, tekstur rusak, ada tanda pembusukan)

IKUTI ATURAN BERIKUT UTK HASIL TERBAIK:
1. Analisis serat daging (kasar/halus), warna daging (merah pucat, merah pekat, jingga, putih), marbling lemak, kelembapan permukaan, dan karakteristik visual spesifik daging tersebut untuk menentukan jenis dan kesegarannya.
2. Jika objek utama gambar BUKAN daging atau merupakan objek acak (manusia, mobil, tanaman, gedung, mainan, dll), Anda HARUS menyetel bidang "category" menjadi "non_meat" dan mengisi bagian "name" dengan "Bukan Daging" serta menyebutkan alasannya di deskripsi. Setel "freshness" menjadi "Tidak Diketahui", "freshness_confidence" menjadi 0, dan "recommendation" menjadi "Gambar tidak teridentifikasi sebagai daging.".
3. Hitung tingkat akurasi (confidence score) antara 0-100 persen untuk jenis daging ("confidence") dan tingkat kesegaran ("freshness_confidence"). Jikalau daging mudah dikenali, berikan nilai tinggi (misal 85-98%).
4. Seluruh teks dalam properti JSON (deskripsi, karakteristik, penjelasan kesegaran, dan informasi nilai gizi) harus menggunakan Bahasa Indonesia yang formal, ramah, edukatif, dan menarik.
5. Harap hitung dan estimasi kandungan gizi (nutritional profile) yang akurat per 100 gram untuk daging yang diidentifikasi.
6. Berikan rekomendasi yang tegas sesuai tingkat kesegaran:
   - "Segar" -> "Daging masih layak dikonsumsi dan aman diolah."
   - "Kurang Segar" -> "Disarankan segera diolah dan tidak disimpan terlalu lama."
   - "Busuk" -> "Daging tidak layak dikonsumsi dan sebaiknya dibuang."`;

    const imagePart = {
      inlineData: {
        mimeType: finalMimeType,
        data: base64Data,
      },
    };

    const textPart = {
      text: "Identifikasi jenis daging dan tingkat kesegarannya pada gambar ini. Klasifikasikan jenis daging serta tingkat kesegarannya, berikan tingkat akurasi untuk masing-masing kelas (confidence score), deskripsi karakteristik pemicu identifikasi jenis dan kesegaran, kandungan gizi akurat per 100g, rekomendasi, dan beberapa menu kuliner populer dari daging ini.",
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2, // Rendah agar lebih konsisten & akurat
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { 
              type: Type.STRING, 
              description: "Kategori wajib: 'sapi' | 'ayam' | 'kambing' | 'babi' | 'ikan' | 'non_meat'" 
            },
            name: { 
              type: Type.STRING, 
              description: "Nama jenis daging dalam Bahasa Indonesia, contoh: 'Daging Sapi'" 
            },
            confidence: { 
              type: Type.INTEGER, 
              description: "Tingkat kepercayaan/akurasi klasifikasi daging dari 0 sampai 100" 
            },
            freshness: {
              type: Type.STRING,
              description: "Tingkat kesegaran wajib: 'Segar' | 'Kurang Segar' | 'Busuk' | 'Tidak Diketahui'"
            },
            freshness_confidence: {
              type: Type.INTEGER,
              description: "Tingkat kepercayaan/akurasi kesegaran daging dari 0 sampai 100"
            },
            freshness_description: {
              type: Type.STRING,
              description: "Penjelasan mengapa tingkat kesegaran dianalisis seperti itu berdasarkan ciri fisik visual."
            },
            recommendation: {
              type: Type.STRING,
              description: "Rekomendasi konsumsi daging berdasarkan tingkat kesegaran."
            },
            description: { 
              type: Type.STRING, 
              description: "Penjelasan ilmiah dan penjelasan visual rinci mengapa gambar diidentifikasi sebagai daging tersebut." 
            },
            characteristics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3-4 ciri fisik visual yang terdeteksi pada gambar (misal: Serat daging tebal, Warna merah terang, Lemak putih padat)"
            },
            nutritional_profile: {
              type: Type.OBJECT,
              properties: {
                calories: { type: Type.STRING, description: "Kandungan Kalori per 100g (contoh: '250 kkal')" },
                protein: { type: Type.STRING, description: "Kandungan Protein per 100g (contoh: '26 g')" },
                fat: { type: Type.STRING, description: "Kandungan Lemak per 100g (contoh: '15 g')" },
                iron: { type: Type.STRING, description: "Kandungan Zat Besi per 100g (contoh: '2.7 mg')" },
                zinc: { type: Type.STRING, description: "Kandungan Seng/Zinc per 100g (contoh: '4.1 mg')" }
              },
              required: ["calories", "protein", "fat", "iron", "zinc"]
            },
            culinary_uses: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
               description: "3 contoh hidangan makanan Indonesia populer yang dibuat dengan jenis daging ini"
            }
          },
          required: ["category", "name", "confidence", "freshness", "freshness_confidence", "freshness_description", "recommendation", "description", "characteristics", "nutritional_profile", "culinary_uses"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Gagal menerima respons analisis dari Google Gemini AI.");
    }

    const resultJson = JSON.parse(resultText);
    return NextResponse.json(resultJson);

  } catch (error: any) {
    console.error("Error in meat identification:", error);
    return NextResponse.json(
      { error: error?.message || "Terjadi kesalahan internal ketika memproses gambar daging." },
      { status: 500 }
    );
  }
}
