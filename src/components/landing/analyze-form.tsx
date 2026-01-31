"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export function AnalyzeForm() {
  const [question, setQuestion] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [referenceUrls, setReferenceUrls] = useState([""]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const addUrl = () => setReferenceUrls([...referenceUrls, ""]);
  const updateUrl = (index: number, value: string) => {
    const newUrls = [...referenceUrls];
    newUrls[index] = value;
    setReferenceUrls(newUrls);
  };
  const removeUrl = (index: number) => 
    setReferenceUrls(referenceUrls.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question, 
          targetUrl, 
          referenceUrls: referenceUrls.filter(u => u.trim()) 
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
      } else {
        setResult({ error: data.error || "Analysis failed" });
      }
    } catch (error) {
      console.error("Request error:", error);
      setResult({ error: "Network error - check if server is running" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="container py-24">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Analyze Your Website for GEO</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="question">Question</Label>
              <Input
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What is GEO?"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Ask a question about a topic you want to analyze
              </p>
            </div>

            <div>
              <Label htmlFor="targetUrl">Target URL (Your Website)</Label>
              <Input
                id="targetUrl"
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://example.com/your-page"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                The page you want to optimize for AI search engines
              </p>
            </div>

            <div>
              <Label>Reference URLs (Competitor Sites)</Label>
              {referenceUrls.map((url, index) => (
                <div key={index} className="flex gap-2 mt-2">
                  <Input
                    type="url"
                    value={url}
                    onChange={(e) => updateUrl(index, e.target.value)}
                    placeholder="https://competitor-site.com"
                  />
                  {referenceUrls.length > 1 && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => removeUrl(index)}
                      className="shrink-0"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button 
                type="button" 
                variant="outline" 
                onClick={addUrl} 
                className="mt-2"
              >
                + Add Reference URL
              </Button>
              <p className="text-sm text-gray-500 mt-1">
                Add well-ranking competitor pages for comparison
              </p>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze Website"
              )}
            </Button>
          </form>

          {result && (
            <div className="mt-8 space-y-6 border-t pt-6">
              {result.error ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    <strong>Error:</strong> {result.error}
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {/* AI Answer Section */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">AI Answer</h3>
                    <div className="p-4 bg-gray-50 rounded-lg border">
                      <p className="whitespace-pre-wrap">{result.aiAnswer}</p>
                    </div>
                  </div>

                  {/* Detected Format */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Detected Format</h3>
                    <div className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {result.detectedFormat}
                    </div>
                  </div>

                  {/* Recommendations */}
                  {result.recommendations && result.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Recommendations for Your Site</h3>
                      <div className="space-y-3">
                        {result.recommendations.map((rec: any, i: number) => (
                          <div 
                            key={i} 
                            className="p-4 border border-orange-200 bg-orange-50 rounded-lg"
                          >
                            <div className="font-semibold text-orange-900 mb-1">
                              ⚠️ {rec.issue}
                            </div>
                            <div className="text-orange-800">
                              {rec.recommendation}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Processing Time */}
                  {result.processingTimeMs && (
                    <div className="text-sm text-gray-500">
                      Analysis completed in {(result.processingTimeMs / 1000).toFixed(2)}s
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}