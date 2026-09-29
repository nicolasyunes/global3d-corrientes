export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string
          name: string
          phone: string | null
          whatsapp: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          whatsapp?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          whatsapp?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          id: string
          material: string
          color: string | null
          brand: string | null
          quantity_grams: number | null
          remaining_grams: number | null
          unit_price: number | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          material: string
          color?: string | null
          brand?: string | null
          quantity_grams?: number | null
          remaining_grams?: number | null
          unit_price?: number | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          material?: string
          color?: string | null
          brand?: string | null
          quantity_grams?: number | null
          remaining_grams?: number | null
          unit_price?: number | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_images: {
        Row: {
          id: string
          order_id: string
          storage_path: string
          note: string | null
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          storage_path: string
          note?: string | null
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          storage_path?: string
          note?: string | null
          position?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'order_images_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_type: string
          description: string
          personalization: string | null
          color_spec: Json
          quantity: number
          unit_price: number | null
          line_total: number | null
          position: number
          product_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_type: string
          product_id?: string | null
          description: string
          personalization?: string | null
          color_spec?: Json
          quantity?: number
          unit_price?: number | null
          line_total?: number | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_type?: string
          product_id?: string | null
          description?: string
          personalization?: string | null
          color_spec?: Json
          quantity?: number
          unit_price?: number | null
          line_total?: number | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
        ]
      }
      order_production_tasks: {
        Row: {
          id: string
          order_id: string
          order_item_id: string | null
          label: string
          location: string | null
          color: string | null
          quantity_total: number
          quantity_done: number
          status: string
          updated_by: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          order_item_id?: string | null
          label: string
          location?: string | null
          color?: string | null
          quantity_total?: number
          quantity_done?: number
          status?: string
          updated_by?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          order_item_id?: string | null
          label?: string
          location?: string | null
          color?: string | null
          quantity_total?: number
          quantity_done?: number
          status?: string
          updated_by?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'order_production_tasks_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_production_tasks_order_item_id_fkey'
            columns: ['order_item_id']
            isOneToOne: false
            referencedRelation: 'order_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_production_tasks_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'operators'
            referencedColumns: ['id']
          },
        ]
      }
      operators: {
        Row: {
          id: string
          name: string
          initials: string
          color: string
          role: string
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          initials: string
          color?: string
          role?: string
          active?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          initials?: string
          color?: string
          role?: string
          active?: boolean
        }
        Relationships: []
      }
      production_events: {
        Row: {
          id: string
          order_id: string
          task_id: string | null
          operator_id: string | null
          kind: string
          label: string
          from_status: string | null
          to_status: string | null
          delta: number | null
          created_at: string
        }
        Insert: {
          order_id: string
          kind: string
          label: string
          task_id?: string | null
          operator_id?: string | null
          from_status?: string | null
          to_status?: string | null
          delta?: number | null
        }
        Update: Record<string, never>
        Relationships: [
          {
            foreignKeyName: 'production_events_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'production_events_operator_id_fkey'
            columns: ['operator_id']
            isOneToOne: false
            referencedRelation: 'operators'
            referencedColumns: ['id']
          },
        ]
      }
      orders: {
        Row: {
          id: string
          customer_id: string
          product_type: string
          color_spec: Json
          personalization: string | null
          measurements: string | null
          observations: string | null
          order_date: string
          due_date: string
          total_amount: number | null
          deposit: number | null
          pending_balance: number | null
          payment_method: string | null
          status: Database['public']['Enums']['order_status']
          created_at: string
          updated_at: string
          origin_channel: string | null
          reference_link: string | null
          title: string | null
          description: string | null
          waiting_reason: string | null
          follow_up_on: string | null
          flexible: boolean
        }
        Insert: {
          id?: string
          customer_id: string
          waiting_reason?: string | null
          follow_up_on?: string | null
          flexible?: boolean
          product_type?: string
          title?: string | null
          description?: string | null
          color_spec?: Json
          personalization?: string | null
          measurements?: string | null
          observations?: string | null
          order_date?: string
          due_date: string
          total_amount?: number | null
          deposit?: number | null
          pending_balance?: number | null
          payment_method?: string | null
          status?: Database['public']['Enums']['order_status']
          created_at?: string
          updated_at?: string
          origin_channel?: string | null
          reference_link?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          waiting_reason?: string | null
          follow_up_on?: string | null
          flexible?: boolean
          product_type?: string
          title?: string | null
          description?: string | null
          color_spec?: Json
          personalization?: string | null
          measurements?: string | null
          observations?: string | null
          order_date?: string
          due_date?: string
          total_amount?: number | null
          deposit?: number | null
          pending_balance?: number | null
          payment_method?: string | null
          status?: Database['public']['Enums']['order_status']
          created_at?: string
          updated_at?: string
          origin_channel?: string | null
          reference_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'orders_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
        ]
      }
      product_images: {
        Row: {
          id: string
          product_id: string
          path: string
          url: string
          position: number
          alt: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          path: string
          url: string
          position?: number
          alt?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          path?: string
          url?: string
          position?: number
          alt?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_images_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      calc_profiles: {
        Row: {
          id: string
          name: string
          currency: string
          filament_price: number
          kwh_price: number
          printer_model: string | null
          printer_watts: number
          machine_life_hours: number
          spare_parts_cost: number
          error_margin_pct: number
          ml_surcharge: number
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          currency?: string
          filament_price?: number
          kwh_price?: number
          printer_model?: string | null
          printer_watts?: number
          machine_life_hours?: number
          spare_parts_cost?: number
          error_margin_pct?: number
          ml_surcharge?: number
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          currency?: string
          filament_price?: number
          kwh_price?: number
          printer_model?: string | null
          printer_watts?: number
          machine_life_hours?: number
          spare_parts_cost?: number
          error_margin_pct?: number
          ml_surcharge?: number
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_parts: {
        Row: {
          id: string
          product_id: string
          label: string
          color: string | null
          quantity: number
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          label: string
          color?: string | null
          quantity?: number
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          label?: string
          color?: string | null
          quantity?: number
          position?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_parts_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          base_price: number | null
          stock_quantity: number
          image_url: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          base_price?: number | null
          stock_quantity?: number
          image_url?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          base_price?: number | null
          stock_quantity?: number
          image_url?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          role: string
          created_at: string
        }
        Insert: {
          id: string
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          role?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      smoke: {
        Row: {
          id: string
          created_at: string
        }
        Insert: {
          id?: string
          created_at?: string
        }
        Update: {
          id?: string
          created_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          type: Database['public']['Enums']['transaction_type']
          order_id: string | null
          amount: number
          payment_account: string | null
          method: string | null
          note: string | null
          transacted_at: string
          created_at: string
          updated_at: string
          inventory_id: string | null
          quantity_grams: number | null
          product_id: string | null
          quantity: number | null
          customer_id: string | null
        }
        Insert: {
          id?: string
          type: Database['public']['Enums']['transaction_type']
          order_id?: string | null
          amount: number
          payment_account?: string | null
          method?: string | null
          note?: string | null
          transacted_at?: string
          created_at?: string
          updated_at?: string
          inventory_id?: string | null
          quantity_grams?: number | null
          product_id?: string | null
          quantity?: number | null
          customer_id?: string | null
        }
        Update: {
          id?: string
          type?: Database['public']['Enums']['transaction_type']
          order_id?: string | null
          amount?: number
          payment_account?: string | null
          method?: string | null
          note?: string | null
          transacted_at?: string
          created_at?: string
          updated_at?: string
          inventory_id?: string | null
          quantity_grams?: number | null
          product_id?: string | null
          quantity?: number | null
          customer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'transactions_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transactions_inventory_id_fkey'
            columns: ['inventory_id']
            isOneToOne: false
            referencedRelation: 'inventory'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transactions_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transactions_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      verify_operator_pin: {
        Args: { p_operator: string; p_pin: string }
        Returns: boolean
      }
      create_operator: {
        Args: {
          p_name: string
          p_initials: string
          p_color: string
          p_role: string
          p_pin: string
          p_admin?: string | null
          p_admin_pin?: string | null
        }
        Returns: string
      }
      set_operator_pin: {
        Args: {
          p_operator: string
          p_new_pin: string
          p_admin: string
          p_admin_pin: string
        }
        Returns: undefined
      }
      increment_task: {
        Args: { p_task: string; p_delta: number; p_operator: string | null }
        Returns: Database['public']['Tables']['order_production_tasks']['Row']
      }
      register_task_failure: {
        Args: { p_task: string; p_operator: string | null }
        Returns: undefined
      }
    }
    Enums: {
      order_status:
        | 'new'
        | 'in_queue'
        | 'printing'
        | 'post_processing'
        | 'finished'
        | 'delivered'
        | 'cancelled'
      transaction_type: '3d_service' | 'supplies_sale' | 'product_sale'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof Database },
  TableName extends (PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof Database },
  TableName extends (PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof Database },
  TableName extends (PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof Database },
  EnumName extends (PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof Database },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never
