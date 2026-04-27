'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ScriptGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: string;
  initialDuration: string;
  onGenerate: (params: ScriptGenerationParams) => Promise<void>;
  isGenerating?: boolean;
}

export interface ScriptGenerationParams {
  topic: string;
  selected_idea_id: string;
  selected_angle_id: string;
  emotional_tone: string;
  creator_type: string;
  audience_description: string;
  accent: string;
  duration_minutes: number;
  script_structure: string;
}

const emotionalTones = [
  "Excited",
  "Professional",
  "Friendly",
  "Educational",
  "Entertaining",
  "Serious",
  "Casual",
];

const creatorTypes = [
  "Tech Product review Youtube channel",
  "Educational Content Creator",
  "Lifestyle Vlogger",
  "News Reporter",
  "Documentary Filmmaker",
  "Gaming Channel",
];

const accents = [
  "Indian English",
  "British English",
  "American English",
  "Australian English",
  "Neutral English",
];

const scriptStructures = [
  "tech_review",
  "educational",
  "news_report",
  "documentary",
  "entertainment",
  "tutorial",
];

export function ScriptGenerationModal({
  isOpen,
  onClose,
  topic,
  initialDuration,
  onGenerate,
  isGenerating = false,
}: ScriptGenerationModalProps) {
  // `isGenerating` is controlled by parent (page). Modal delegates generation to parent via onGenerate.
  const [formData, setFormData] = useState<ScriptGenerationParams>({
    topic: '',
    selected_idea_id: "",
    selected_angle_id: "",
    emotional_tone: "",
    creator_type: "",
    audience_description: "",
    accent: "",
    duration_minutes: 0,
    script_structure: "",
  });
  

  // Update formData when props change
  useEffect(() => {
    if (isOpen) {
      setFormData(prevData => ({
        ...prevData,
        topic: topic, // Update topic from props
        duration_minutes: parseInt(initialDuration) || 10, // Update duration from props
      }));
    }
  }, [isOpen, topic, initialDuration]);

  const getRandomTwoDigit = () => Math.floor(10 + Math.random() * 90);

  const handleSubmit = async () => {
    try {
      const payload = {
        topic: formData.topic,
        context: {
          topic: formData.topic,
          selected_idea_id: String(getRandomTwoDigit()),
          selected_angle_id: String(getRandomTwoDigit()),
          selected_idea: {},           // mock empty object
        gap_context: {},             // mock empty object
        pipeline_assembled_at: new Date().toISOString(), // timestamp
        },
        emotional_tone: formData.emotional_tone.toLowerCase(),
        creator_type: formData.creator_type,
        audience_description: formData.audience_description,
        accent: formData.accent.toLowerCase(),
        duration_minutes: formData.duration_minutes,
        script_structure: formData.script_structure,

      };
  
      console.log("FINAL PAYLOAD:", payload);
  
      await onGenerate(payload as any);
    } catch (error) {
      console.error("Error generating script:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isGenerating && !open && onClose()}>
      <DialogContent className="max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Script</DialogTitle>
          <DialogDescription>
            Customize your script generation parameters below
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="topic">Topic</Label>
            <Input
              id="topic"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              disabled
              className="bg-gray-50 text-gray-900 disabled:opacity-100"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              value={formData.duration_minutes}
              onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
              min="1"
              max="60"
              disabled
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="emotional_tone">Emotional Tone</Label>
            <Select
              value={formData.emotional_tone}
              onValueChange={(value: string) => setFormData({ ...formData, emotional_tone: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select tone" />
              </SelectTrigger>
              <SelectContent>
                {emotionalTones.map((tone) => (
                  <SelectItem key={tone} value={tone}>
                    {tone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="creator_type">Creator Type</Label>
            <Select
              value={formData.creator_type}
              onValueChange={(value: string) => setFormData({ ...formData, creator_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select creator type" />
              </SelectTrigger>
              <SelectContent>
                {creatorTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="accent">Accent</Label>
            <Select
              value={formData.accent}
              onValueChange={(value: string) => setFormData({ ...formData, accent: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select accent" />
              </SelectTrigger>
              <SelectContent>
                {accents.map((accent) => (
                  <SelectItem key={accent} value={accent}>
                    {accent}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="script_structure">Script Structure</Label>
            <Select
              value={formData.script_structure}
              onValueChange={(value: string) => setFormData({ ...formData, script_structure: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select structure" />
              </SelectTrigger>
              <SelectContent>
                {scriptStructures.map((structure) => (
                  <SelectItem key={structure} value={structure}>
                    {structure.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="audience_description">Audience Description</Label>
            <Input
              id="audience_description"
              value={formData.audience_description}
              onChange={(e) => setFormData({ ...formData, audience_description: e.target.value })}
              placeholder="Describe your target audience"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Script...
              </>
            ) : (
              "Generate Script"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}