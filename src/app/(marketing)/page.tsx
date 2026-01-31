import { AnalyzeForm } from "@/components/landing/analyze-form"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8">GEO Website Analyzer</h1>
      <AnalyzeForm />
    </div>
  )
}
