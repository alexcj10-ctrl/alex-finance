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
          player_code: string | null;
          account_active: boolean;
          local_progress_imported_at: string | null;
          avatar_path: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          role?: AppRole;
          player_code?: string | null;
          account_active?: boolean;
          local_progress_imported_at?: string | null;
          avatar_path?: string | null;
          created_at?: string;
        };
        Update: {
          display_name?: string;
          player_code?: string | null;
          account_active?: boolean;
          local_progress_imported_at?: string | null;
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
      lesson_assignments: {
        Row: {
          id: string;
          lesson_id: string;
          team_id: string;
          player_id: string | null;
          assigned_by: string;
          assigned_at: string;
          due_at: string | null;
          active: boolean;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          team_id: string;
          player_id?: string | null;
          assigned_by: string;
          assigned_at?: string;
          due_at?: string | null;
          active?: boolean;
        };
        Update: {
          due_at?: string | null;
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
      quiz_questions: {
        Row: {
          id: string;
          lesson_id: string;
          prompt: string;
          choices: Json;
          position: number;
          active: boolean;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          prompt: string;
          choices: Json;
          position: number;
          active?: boolean;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          prompt?: string;
          choices?: Json;
          position?: number;
          active?: boolean;
          is_demo?: boolean;
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
          attempt_number: number;
          client_attempt_id: string | null;
          points_earned: number;
          completed_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          player_id: string;
          lesson_id: string;
          total_questions: number;
          correct_answers: number;
          attempt_number: number;
          client_attempt_id?: string | null;
          points_earned?: number;
          completed_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      quiz_answers: {
        Row: {
          attempt_id: string;
          team_id: string;
          player_id: string;
          lesson_id: string;
          question_id: string;
          selected_choice_id: string;
          is_correct: boolean;
          feedback: string;
          answered_at: string;
        };
        Insert: {
          attempt_id: string;
          team_id: string;
          player_id: string;
          lesson_id: string;
          question_id: string;
          selected_choice_id: string;
          is_correct: boolean;
          feedback: string;
          answered_at?: string;
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
          dedupe_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          player_id: string;
          lesson_id?: string | null;
          event_type: string;
          metadata?: Json;
          dedupe_key?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      assign_lesson: {
        Args: {
          p_team_id: string;
          p_lesson_id: string;
          p_player_id?: string | null;
          p_due_at?: string | null;
        };
        Returns: Database['public']['Tables']['lesson_assignments']['Row'];
      };
      complete_lesson: {
        Args: { p_team_id: string; p_lesson_id: string };
        Returns: Database['public']['Tables']['lesson_progress']['Row'];
      };
      provision_player_profile: {
        Args: {
          p_user_id: string;
          p_display_name: string;
          p_player_code: string;
          p_team_id: string;
          p_active: boolean;
          p_coach_id: string;
        };
        Returns: Database['public']['Tables']['profiles']['Row'];
      };
      record_login: {
        Args: { p_team_id: string };
        Returns: Database['public']['Tables']['activity_events']['Row'];
      };
      record_video_checkpoint: {
        Args: {
          p_team_id: string;
          p_lesson_id: string;
          p_variant_id: string;
          p_checkpoint: VideoCheckpoint;
          p_watched_percent: number;
          p_last_position_seconds: number;
        };
        Returns: Database['public']['Tables']['video_progress']['Row'];
      };
      set_lesson_assignment_active: {
        Args: { p_assignment_id: string; p_active: boolean };
        Returns: Database['public']['Tables']['lesson_assignments']['Row'];
      };
      start_lesson: {
        Args: { p_team_id: string; p_lesson_id: string };
        Returns: Database['public']['Tables']['lesson_progress']['Row'];
      };
      submit_quiz: {
        Args: {
          p_team_id: string;
          p_lesson_id: string;
          p_answers: Json;
          p_client_attempt_id?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      app_role: AppRole;
      lesson_status: DatabaseLessonStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
