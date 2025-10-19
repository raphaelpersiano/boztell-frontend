export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      leads: {
        Row: {
          id: string
          utm_id: string | null
          leads_status: string | null
          contact_status: string | null
          name: string | null
          phone: string | null
          outstanding: number | null
          loan_type: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          utm_id?: string | null
          leads_status?: string | null
          contact_status?: string | null
          name?: string | null
          phone?: string | null
          outstanding?: number | null
          loan_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          utm_id?: string | null
          leads_status?: string | null
          contact_status?: string | null
          name?: string | null
          phone?: string | null
          outstanding?: number | null
          loan_type?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      rooms: {
        Row: {
          id: string
          title: string | null
          phone: string | null
          leads_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          title?: string | null
          phone?: string | null
          leads_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string | null
          phone?: string | null
          leads_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      room_participants: {
        Row: {
          room_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          room_id: string
          user_id: string
          joined_at?: string
        }
        Update: {
          room_id?: string
          user_id?: string
          joined_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          room_id: string
          content_type: string | null
          content_text: string | null
          media_type: string | null
          media_id: string | null
          gcs_filename: string | null
          gcs_url: string | null
          file_size: number | null
          mime_type: string | null
          original_filename: string | null
          wa_message_id: string | null
          status: string | null
          status_timestamp: string | null
          metadata: Json | null
          reply_to_wa_message_id: string | null
          reaction_emoji: string | null
          reaction_to_wa_message_id: string | null
          user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          room_id: string
          content_type?: string | null
          content_text?: string | null
          media_type?: string | null
          media_id?: string | null
          gcs_filename?: string | null
          gcs_url?: string | null
          file_size?: number | null
          mime_type?: string | null
          original_filename?: string | null
          wa_message_id?: string | null
          status?: string | null
          status_timestamp?: string | null
          metadata?: Json | null
          reply_to_wa_message_id?: string | null
          reaction_emoji?: string | null
          reaction_to_wa_message_id?: string | null
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          content_type?: string | null
          content_text?: string | null
          media_type?: string | null
          media_id?: string | null
          gcs_filename?: string | null
          gcs_url?: string | null
          file_size?: number | null
          mime_type?: string | null
          original_filename?: string | null
          wa_message_id?: string | null
          status?: string | null
          status_timestamp?: string | null
          metadata?: Json | null
          reply_to_wa_message_id?: string | null
          reaction_emoji?: string | null
          reaction_to_wa_message_id?: string | null
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      message_status_history: {
        Row: {
          id: number
          message_id: string | null
          status: string | null
          timestamp: string | null
          recipient_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: number
          message_id?: string | null
          status?: string | null
          timestamp?: string | null
          recipient_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: number
          message_id?: string | null
          status?: string | null
          timestamp?: string | null
          recipient_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
    }
  }
}
