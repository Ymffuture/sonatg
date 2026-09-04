export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_announcements: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          message: string
          notify_subscribers: boolean
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          message: string
          notify_subscribers?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          message?: string
          notify_subscribers?: boolean
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_id: string | null
          body: string
          cover_image_url: string | null
          created_at: string
          description: string
          id: string
          published: boolean
          read_mins: number
          slug: string
          tag: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string
          id?: string
          published?: boolean
          read_mins?: number
          slug: string
          tag?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string
          id?: string
          published?: boolean
          read_mins?: number
          slug?: string
          tag?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      broadcast_posters: {
        Row: {
          chat_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_posters_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_clears: {
        Row: {
          chat_id: string
          cleared_before: string
          user_id: string
        }
        Insert: {
          chat_id: string
          cleared_before?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          cleared_before?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_clears_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_invites: {
        Row: {
          allowed_email: string | null
          chat_id: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          token: string
          uses: number
        }
        Insert: {
          allowed_email?: string | null
          chat_id: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          token: string
          uses?: number
        }
        Update: {
          allowed_email?: string | null
          chat_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          token?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "chat_invites_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_members: {
        Row: {
          chat_id: string
          is_pinned: boolean
          joined_at: string
          pinned_at: string | null
          role: Database["public"]["Enums"]["chat_member_role"]
          user_id: string
        }
        Insert: {
          chat_id: string
          is_pinned?: boolean
          joined_at?: string
          pinned_at?: string | null
          role?: Database["public"]["Enums"]["chat_member_role"]
          user_id: string
        }
        Update: {
          chat_id?: string
          is_pinned?: boolean
          joined_at?: string
          pinned_at?: string | null
          role?: Database["public"]["Enums"]["chat_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          avatar_url: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          disappearing_seconds: number | null
          id: string
          is_broadcast: boolean
          is_group: boolean
          is_hidden: boolean
          last_message_at: string
          title: string | null
        }
        Insert: {
          avatar_url?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          disappearing_seconds?: number | null
          id?: string
          is_broadcast?: boolean
          is_group?: boolean
          is_hidden?: boolean
          last_message_at?: string
          title?: string | null
        }
        Update: {
          avatar_url?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          disappearing_seconds?: number | null
          id?: string
          is_broadcast?: boolean
          is_group?: boolean
          is_hidden?: boolean
          last_message_at?: string
          title?: string | null
        }
        Relationships: []
      }
      classes: {
        Row: {
          chat_id: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          join_code: string
          name: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          join_code: string
          name: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          join_code?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      message_bookmarks: {
        Row: {
          chat_id: string
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_bookmarks_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_bookmarks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_bookmarks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "visible_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "visible_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          chat_id: string
          created_at: string
          deleted_at: string | null
          duration_ms: number | null
          edited_at: string | null
          expires_at: string | null
          file_name: string | null
          file_size: number | null
          id: string
          is_encrypted: boolean
          is_forwarded: boolean
          kind: string
          media_url: string | null
          pinned_at: string | null
          pinned_by: string | null
          reply_to_id: string | null
          scheduled_at: string | null
          sender_id: string
          transcript: string | null
        }
        Insert: {
          body?: string | null
          chat_id: string
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          edited_at?: string | null
          expires_at?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          is_encrypted?: boolean
          is_forwarded?: boolean
          kind?: string
          media_url?: string | null
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          scheduled_at?: string | null
          sender_id: string
          transcript?: string | null
        }
        Update: {
          body?: string | null
          chat_id?: string
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          edited_at?: string | null
          expires_at?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          is_encrypted?: boolean
          is_forwarded?: boolean
          kind?: string
          media_url?: string | null
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          scheduled_at?: string | null
          sender_id?: string
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "visible_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_flags: {
        Row: {
          blocked: boolean
          body_snapshot: string
          categories: string[]
          chat_id: string | null
          created_at: string
          id: string
          message_id: string | null
          pattern_signals: Json
          reviewed: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          score: number
          sender_id: string
          severity: string
        }
        Insert: {
          blocked?: boolean
          body_snapshot?: string
          categories?: string[]
          chat_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          pattern_signals?: Json
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          sender_id: string
          severity?: string
        }
        Update: {
          blocked?: boolean
          body_snapshot?: string
          categories?: string[]
          chat_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          pattern_signals?: Json
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          sender_id?: string
          severity?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          notify_app_updates: boolean
          notify_offline_messages: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          notify_app_updates?: boolean
          notify_offline_messages?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          notify_app_updates?: boolean
          notify_offline_messages?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      org_domains: {
        Row: {
          created_at: string
          created_by: string | null
          domain: string
          id: string
          is_active: boolean
          label: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain: string
          id?: string
          is_active?: boolean
          label?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain?: string
          id?: string
          is_active?: boolean
          label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      org_invites: {
        Row: {
          created_at: string
          domain: string | null
          email: string
          id: string
          invited_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          email: string
          id?: string
          invited_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          email?: string
          id?: string
          invited_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      org_settings: {
        Row: {
          id: string
          max_doc_bytes: number
          max_image_bytes: number
          updated_at: string
        }
        Insert: {
          id: string
          max_doc_bytes?: number
          max_image_bytes?: number
          updated_at?: string
        }
        Update: {
          id?: string
          max_doc_bytes?: number
          max_image_bytes?: number
          updated_at?: string
        }
        Relationships: []
      }
      poll_options: {
        Row: {
          id: string
          label: string
          poll_id: string
          position: number
        }
        Insert: {
          id?: string
          label: string
          poll_id: string
          position?: number
        }
        Update: {
          id?: string
          label?: string
          poll_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          allow_multiple: boolean
          chat_id: string
          closes_at: string | null
          correct_option_index: number | null
          created_at: string
          created_by: string
          id: string
          is_quiz: boolean
          message_id: string | null
          question: string
          results_visible: boolean
        }
        Insert: {
          allow_multiple?: boolean
          chat_id: string
          closes_at?: string | null
          correct_option_index?: number | null
          created_at?: string
          created_by: string
          id?: string
          is_quiz?: boolean
          message_id?: string | null
          question: string
          results_visible?: boolean
        }
        Update: {
          allow_multiple?: boolean
          chat_id?: string
          closes_at?: string | null
          correct_option_index?: number | null
          created_at?: string
          created_by?: string
          id?: string
          is_quiz?: boolean
          message_id?: string | null
          question?: string
          results_visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "polls_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "visible_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          email: string | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          is_ai: boolean
          is_pro: boolean
          last_seen: string | null
          theme_id: string | null
          threads_url: string | null
          x_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          facebook_url?: string | null
          id: string
          instagram_url?: string | null
          is_ai?: boolean
          is_pro?: boolean
          last_seen?: string | null
          theme_id?: string | null
          threads_url?: string | null
          x_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          is_ai?: boolean
          is_pro?: boolean
          last_seen?: string | null
          theme_id?: string | null
          threads_url?: string | null
          x_url?: string | null
        }
        Relationships: []
      }
      reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "visible_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          chat_id: string | null
          created_at: string
          details: string | null
          id: string
          reason: string
          reported_id: string
          reporter_id: string
          status: string
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reported_id: string
          reporter_id: string
          status?: string
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reported_id?: string
          reporter_id?: string
          status?: string
        }
        Relationships: []
      }
      status_views: {
        Row: {
          status_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          status_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          status_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_views_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      statuses: {
        Row: {
          background_color: string | null
          body: string | null
          created_at: string
          duration_ms: number | null
          expires_at: string
          id: string
          kind: string
          media_path: string | null
          media_provider: string
          media_public_id: string | null
          media_url: string | null
          privacy: string
          user_id: string
        }
        Insert: {
          background_color?: string | null
          body?: string | null
          created_at?: string
          duration_ms?: number | null
          expires_at?: string
          id?: string
          kind?: string
          media_path?: string | null
          media_provider?: string
          media_public_id?: string | null
          media_url?: string | null
          privacy?: string
          user_id: string
        }
        Update: {
          background_color?: string | null
          body?: string | null
          created_at?: string
          duration_ms?: number | null
          expires_at?: string
          id?: string
          kind?: string
          media_path?: string | null
          media_provider?: string
          media_public_id?: string | null
          media_url?: string | null
          privacy?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          current_period_end: string | null
          provider: string | null
          provider_customer_id: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          current_period_end?: string | null
          provider?: string | null
          provider_customer_id?: string | null
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          current_period_end?: string | null
          provider?: string | null
          provider_customer_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_moderation: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          reason: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          reason?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_dashboard_stats: {
        Row: {
          active_users_24h: number | null
          active_users_7d: number | null
          messages_24h: number | null
          messages_7d: number | null
          total_members: number | null
          unreviewed_flags: number | null
          unreviewed_high_severity_flags: number | null
        }
        Relationships: []
      }
      moderation_queue: {
        Row: {
          blocked: boolean | null
          body_snapshot: string | null
          categories: string[] | null
          chat_id: string | null
          created_at: string | null
          id: string | null
          pattern_signals: Json | null
          reviewed: boolean | null
          score: number | null
          sender_display_name: string | null
          sender_id: string | null
          severity: string | null
        }
        Relationships: []
      }
      visible_messages: {
        Row: {
          body: string | null
          chat_id: string | null
          created_at: string | null
          deleted_at: string | null
          duration_ms: number | null
          edited_at: string | null
          expires_at: string | null
          file_name: string | null
          file_size: number | null
          id: string | null
          is_encrypted: boolean | null
          is_forwarded: boolean | null
          kind: string | null
          media_url: string | null
          pinned_at: string | null
          pinned_by: string | null
          reply_to_id: string | null
          scheduled_at: string | null
          sender_id: string | null
          transcript: string | null
        }
        Insert: {
          body?: string | null
          chat_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          duration_ms?: number | null
          edited_at?: string | null
          expires_at?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string | null
          is_encrypted?: boolean | null
          is_forwarded?: boolean | null
          kind?: string | null
          media_url?: string | null
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          scheduled_at?: string | null
          sender_id?: string | null
          transcript?: string | null
        }
        Update: {
          body?: string | null
          chat_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          duration_ms?: number | null
          edited_at?: string | null
          expires_at?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string | null
          is_encrypted?: boolean | null
          is_forwarded?: boolean | null
          kind?: string | null
          media_url?: string | null
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          scheduled_at?: string | null
          sender_id?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "visible_messages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_delete_user: { Args: { _target: string }; Returns: undefined }
      admin_purge_user_data: { Args: { _target: string }; Returns: undefined }
      can_post_in_chat: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      cleanup_expired_messages: { Args: never; Returns: undefined }
      compute_dashboard_stats: {
        Args: never
        Returns: {
          active_users_24h: number
          active_users_7d: number
          messages_24h: number
          messages_7d: number
          total_members: number
          unreviewed_flags: number
          unreviewed_high_severity_flags: number
        }[]
      }
      generate_chat_invite_token: { Args: never; Returns: string }
      generate_class_join_code: { Args: never; Returns: string }
      get_public_profile: {
        Args: { profile_id: string }
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          facebook_url: string
          id: string
          instagram_url: string
          is_ai: boolean
          is_pro: boolean
          threads_url: string
          x_url: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_chat_member: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      is_user_offline: { Args: { _user_id: string }; Returns: boolean }
      join_chat_by_invite: { Args: { _token: string }; Returns: string }
      join_class_by_code: { Args: { _code: string }; Returns: string }
      preview_chat_invite: {
        Args: { _token: string }
        Returns: {
          allowed_email: string
          already_member: boolean
          avatar_url: string
          chat_id: string
          is_group: boolean
          is_valid: boolean
          reason: string
          title: string
        }[]
      }
      purge_inactive_users: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      chat_member_role: "admin" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      chat_member_role: ["admin", "member"],
    },
  },
} as const
