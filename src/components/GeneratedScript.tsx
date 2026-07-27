'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Link, LineChart } from "lucide-react";

interface GeneratedScriptProps {
  script: string;
  estimated_word_count: number;
  source_urls: string[];
  analysis: {
    examples_count: number;
    research_facts_count: number;
    proverbs_count: number;
  };
}

export function GeneratedScript({
  script,
  estimated_word_count,
  source_urls,
  analysis,
}: GeneratedScriptProps) {
  // Helper: convert plain text into nodes with formatting rules
  // Format: *** becomes <hr/>, *word* becomes <strong>word</strong>
  const renderScriptWithFormatting = (text: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    if (!text) return nodes;

    // First, split by triple asterisks (***) to create sections separated by <hr/>
    const sections = text.split(/\*\*\*/);

    sections.forEach((section, sectionIndex) => {
      if (!section) {
        // Empty section, just add an hr (will happen between consecutive ***)
        if (sectionIndex < sections.length - 1) {
          nodes.push(<hr key={`hr-${sectionIndex}`} className="my-6 border-gray-200" />);
        }
        return;
      }

      // Process each section for single asterisk patterns (*word* -> <strong>word</strong>)
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let keyCounter = 0;

      // Match *word* pattern (but not *** since we already split on that)
      // Pattern: * followed by one or more non-asterisk characters, followed by *
      const singleAsteriskRegex = /\*([^*\n]+?)\*/g;
      let match: RegExpExecArray | null;

      while ((match = singleAsteriskRegex.exec(section)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
          const beforeText = section.slice(lastIndex, match.index);
          if (beforeText) {
            // Preserve newlines in the text
            const lines = beforeText.split('\n');
            lines.forEach((line, lineIdx) => {
              if (line) parts.push(line);
              if (lineIdx < lines.length - 1) {
                parts.push(<br key={`br-${sectionIndex}-${keyCounter++}`} />);
              }
            });
          }
        }

        // Add the bold text (content between single asterisks)
        parts.push(
          <strong key={`strong-${sectionIndex}-${keyCounter++}`}>
            {match[1]}
          </strong>
        );

        lastIndex = match.index + match[0].length;
      }

      // Add remaining text after last match
      if (lastIndex < section.length) {
        const afterText = section.slice(lastIndex);
        if (afterText) {
          // Preserve newlines
          const lines = afterText.split('\n');
          lines.forEach((line, lineIdx) => {
            if (line) parts.push(line);
            if (lineIdx < lines.length - 1) {
              parts.push(<br key={`br-${sectionIndex}-${keyCounter++}`} />);
            }
          });
        }
      }

      // If no matches, add the whole section as-is (with preserved newlines)
      if (parts.length === 0) {
        const lines = section.split('\n');
        lines.forEach((line, lineIdx) => {
          if (line) parts.push(line);
          if (lineIdx < lines.length - 1) {
            parts.push(<br key={`br-${sectionIndex}-${keyCounter++}`} />);
          }
        });
      }

      // Add this section's content
      if (parts.length > 0) {
        nodes.push(
          <span key={`section-${sectionIndex}`} className="whitespace-pre-wrap">
            {parts}
          </span>
        );
      }

      // Add <hr/> between sections (but not after the last section)
      if (sectionIndex < sections.length - 1) {
        nodes.push(<hr key={`hr-${sectionIndex}`} className="my-6 border-gray-200" />);
      }
    });

    return nodes;
  };
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center">
            <FileText className="w-6 h-6 mr-2" />
            Generated Script
          </CardTitle>
          <CardDescription>
            Approximately {estimated_word_count} words
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-lg leading-relaxed">
            {/**
             * Rendering rules:
             * - Triple asterisks (***) anywhere produce an <hr />
             * - Single asterisk (*word*) produce <strong>bold</strong> text
             * - Preserve newlines as <br />
             */}
            {renderScriptWithFormatting(script)}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center">
              <LineChart className="w-5 h-5 mr-2" />
              Script Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Examples Used</span>
              <Badge variant="secondary">{analysis.examples_count}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Research Facts</span>
              <Badge variant="secondary">{analysis.research_facts_count}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Proverbs/Sayings</span>
              <Badge variant="secondary">{analysis.proverbs_count}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center">
              <Link className="w-5 h-5 mr-2" />
              Research Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {source_urls.map((url, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Badge variant="outline" className="truncate max-w-[300px]">
                    {url}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(url, '_blank')}
                  >
                    Visit
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}