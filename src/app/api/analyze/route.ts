import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import Groq from "groq-sdk";

// Disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { question, targetUrl, referenceUrls } = body;

    if (
      !question ||
      !targetUrl ||
      !Array.isArray(referenceUrls) ||
      referenceUrls.length === 0
    ) {
      return NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 }
      );
    }

    /* -----------------------------
       PHASE 3: WEBSITE EXTRACTION
    ------------------------------*/

    const extractedData: any[] = [];

    for (const url of [targetUrl, ...referenceUrls]) {
      try {
        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);

        const sections: any[] = [];

        $("h1, h2, h3").each((_, elem) => {
          const heading = $(elem).text().trim();
          const level = elem.name;
          let text = "";

          let next = $(elem).next();
          while (
            next.length &&
            !next.is("h1, h2, h3") &&
            next.prop("tagName") !== "FOOTER"
          ) {
            text += next.text().trim() + " ";
            next = next.next();
          }

          const words = text
            .split(/\s+/)
            .filter((w) => w.length > 0);

          sections.push({
            heading,
            level,
            wordCount: words.length,
            text: text.trim(),
          });
        });

        extractedData.push({
          url,
          type: url === targetUrl ? "target" : "reference",
          sections,
        });
      } catch (err) {
        extractedData.push({
          url,
          type: url === targetUrl ? "target" : "reference",
          sections: [],
        });
      }
    }

    /* -----------------------------
       PHASE 4: GROQ AI ANSWER
    ------------------------------*/

    let aiAnswer = "AI analysis unavailable - please check your API key";
    let detectedFormat = "unknown";

    try {
      console.log("🔍 Checking Groq API Key...");
      console.log("GROQ_API_KEY exists?", !!process.env.GROQ_API_KEY);
      
      if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is not set in environment variables");
      }

      const groq = new Groq({
        apiKey: process.env.GROQ_API_KEY,
      });

      console.log("📤 Sending request to Groq...");

      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile", // Free and fast!
        messages: [
          {
            role: "user",
            content: `Explain ${question} for beginners. Use clear sections, examples, and simple language.`
          }
        ],
        max_tokens: 1024,
        temperature: 0.7,
      });

      console.log("✅ Got response from Groq!");

      aiAnswer = completion.choices[0]?.message?.content || "No response generated";

      /* -----------------------------
         FORMAT DETECTION
      ------------------------------*/

      detectedFormat = "paragraph";

      if (aiAnswer.toLowerCase().includes("faq")) {
        detectedFormat = "FAQs";
      } else if (aiAnswer.match(/\d+\./)) {
        detectedFormat = "steps";
      } else if (aiAnswer.match(/[-•*]\s+/)) {
        detectedFormat = "bullet points";
      }

      console.log("📊 Detected format:", detectedFormat);
    } catch (aiError) {
      console.error("❌ AI call failed:", aiError);
      if (aiError instanceof Error) {
        console.error("Error message:", aiError.message);
      }
    }

    /* -----------------------------
       PHASE 5: ANALYSIS
    ------------------------------*/

    const analysis = extractedData.map((data) => {
      const headings = data.sections.map((s: any) =>
        s.heading.toLowerCase()
      );

      const hasFaq = headings.some((h: string) => h.includes("faq"));
      const hasBenefits = headings.some((h: string) =>
        h.includes("benefit")
      );
      const hasSteps = headings.some(
        (h: string) => h.includes("step") || h.includes("how")
      );

      const avgWordCount =
        data.sections.length > 0
          ? data.sections.reduce(
              (sum: number, s: any) => sum + s.wordCount,
              0
            ) / data.sections.length
          : 0;

      const missingSections: string[] = [];

      if (detectedFormat === "FAQs" && !hasFaq) missingSections.push("FAQs");
      if (aiAnswer.toLowerCase().includes("benefit") && !hasBenefits)
        missingSections.push("Benefits");
      if (detectedFormat === "steps" && !hasSteps)
        missingSections.push("Steps");

      const structureMismatch =
        detectedFormat === "bullet points" && avgWordCount > 120;

      return {
        url: data.url,
        type: data.type,
        missingSections,
        avgWordCount,
        structureMismatch,
      };
    });

    /* -----------------------------
       PHASE 6: RECOMMENDATIONS
       (TARGET SITE ONLY)
    ------------------------------*/

    const recommendations: any[] = [];

    const targetAnalysis = analysis.find(
      (a) => a.url === targetUrl
    );

    if (targetAnalysis) {
      if (targetAnalysis.missingSections.includes("FAQs")) {
        recommendations.push({
          issue: "Missing FAQs",
          recommendation: "Add 3–5 FAQs answering common user questions.",
        });
      }

      if (targetAnalysis.missingSections.includes("Benefits")) {
        recommendations.push({
          issue: "Missing Benefits Section",
          recommendation:
            "Add a section highlighting the key benefits clearly.",
        });
      }

      if (targetAnalysis.missingSections.includes("Steps")) {
        recommendations.push({
          issue: "Missing Step-by-Step Explanation",
          recommendation:
            "Include a beginner-friendly step-by-step guide.",
        });
      }

      if (targetAnalysis.structureMismatch) {
        recommendations.push({
          issue: "Long Paragraphs Detected",
          recommendation:
            "Break long paragraphs into bullet points for better AI readability.",
        });
      }

      if (targetAnalysis.avgWordCount > 150) {
        recommendations.push({
          issue: "Sections Too Long",
          recommendation:
            "Shorten sections or split them into sub-sections.",
        });
      }
    }

    /* -----------------------------
       DEFINITION CHECK (TARGET)
    ------------------------------*/

    const targetData = extractedData.find(
      (d) => d.url === targetUrl
    );

    if (targetData && targetData.sections.length > 0) {
      const firstText = targetData.sections[0].text.toLowerCase();
      const keywords = question.toLowerCase().split(" ");

      const hasKeyword = keywords.some((k) =>
        firstText.includes(k)
      );
      const hasDefinitionWord = firstText.includes("definition");

      if (
        firstText.length < 200 ||
        (!hasKeyword && !hasDefinitionWord)
      ) {
        recommendations.push({
          issue: "No Clear Definition Early",
          recommendation:
            "Add a concise definition in the first 200 words.",
        });
      }
    }

    /* -----------------------------
       RESPONSE
    ------------------------------*/

    return NextResponse.json({
      status: "success",
      question,
      targetUrl,
      referenceUrls,
      detectedFormat,
      aiAnswer,
      extractedData,
      analysis,
      recommendations,
      processingTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}