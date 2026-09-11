export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = 'player' | 'coach';
export type DatabaseLessonStatus = 'da_fare' | 'in_corso' | 'completata';
export type VideoCheckpoint = 0 | 25 | 50 | 75 | 100;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          role: AppRole;
          avatar_path: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          role?: AppRole;
          avatar_path?: string | null;
          created_at?: string;
        };
        Update: {
          display_name?: string;
          avatar_path?: string | null;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          name: string;
          season: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          season: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          season?: string;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          team_id: string;
          profile_id: string;
          role: AppRole;
          active: boolean;
        };
        Insert: {
          team_id: string;
          profile_id: string;
          role: AppRole;
          active?: boolean;
        };
        Update: {
          role?: AppRole;
          active?: boolean;
        };
        Relationships: [];
      };
      lesson_progress: {
        Row: {
          team_id: string;
          player_id: string;
          lesson_id: string;
          status: DatabaseLessonStatus;
          progress_percent: number;
          assigned_at: string;
          started_at: string | null;
          completed_at: string | null;
          points_earned: number;
          updated_at: string;
        };
        Insert: {
          team_id: string;
          player_id: string;
          lesson_id: string;
          status?: DatabaseLessonStatus;
          progress_percent?: number;
          assigned_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          points_earned?: number;
          updated_at?: string;
        };
        Update: {
          status?: DatabaseLessonStatus;
          progress_percent?: number;
          started_at?: string | null;
          completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      video_progress: {
        Row: {
          team_id: string;
          player_id: string;
          lesson_id: string;
          variant_id: string;
          watched_percent: number;
          last_position_seconds: number;
          last_checkpoint: VideoCheckpoint;
          completed: boolean;
          updated_at: string;
        };
        Insert: {
          team_id: string;
          player_id: string;
          lesson_id: string;
          variant_id: string;
          watched_percent?: number;
          last_position_seconds?: number;
          last_checkpoint?: VideoCheckpoint;
          completed?: boolean;
          updated_at?: string;
        };
        Update: {
          watched_percent?: number;
          last_position_seconds?: number;
          last_checkpoint?: VideoCheckpoint;
          completed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      quiz_attempts: {
        Row: {
          id: string;
          team_id: string;
          player_id: string;
          lesson_id: string;
          score: number;
          total_questions: number;
          correct_answers: number;
          completed_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          player_id: string;
          lesson_id: string;
          total_questions: number;
          correct_answers: number;
          completed_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      player_trophies: {
        Row: {
          team_id: string;
          player_id: string;
          trophy_id: string;
          unlocked_at: string;
        };
        Insert: {
          team_id: string;
          player_id: string;
          trophy_id: string;
          unlocked_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      activity_events: {
        Row: {
          id: string;
          team_id: string;
          player_id: string;
          lesson_id: string | null;
          event_type: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          player_id: string;
          lesson_id?: string | null;
          event_type: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      app_role: AppRole;
      lesson_status: DatabaseLessonStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
