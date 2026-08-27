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
      categories: {
        Row: {
          id: string
          slug: string
          name: string
          icon: string | null
          position: number
          featured: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          icon?: string | null
          position?: number
          featured?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          icon?: string | null
          position?: number
          featured?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
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
          sku: string | null
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
          sku?: string | null
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
          sku?: string | null
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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_type: string
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
          label: string
          location: string | null
          done: boolean
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          label: string
          location?: string | null
          done?: boolean
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          label?: string
          location?: string | null
          done?: boolean
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
        }
        Insert: {
          id?: string
          customer_id: string
          product_type: string
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
          product_type?: string
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
      product_variants: {
        Row: {
          id: string
          product_id: string
          name: string | null
          color: string | null
          size: string | null
          personalization: boolean
          price_delta: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          name?: string | null
          color?: string | null
          size?: string | null
          personalization?: boolean
          price_delta?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          name?: string | null
          color?: string | null
          size?: string | null
          personalization?: boolean
          price_delta?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_variants_product_id_fkey'
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
          slug: string | null
          sku: string | null
          compare_at_price: number | null
          custom_on_request: boolean
          personalizable: boolean
          weight_grams: number | null
          category_id: string | null
          subcategory: string | null
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
          slug?: string | null
          sku?: string | null
          compare_at_price?: number | null
          custom_on_request?: boolean
          personalizable?: boolean
          weight_grams?: number | null
          category_id?: string | null
          subcategory?: string | null
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
          slug?: string | null
          sku?: string | null
          compare_at_price?: number | null
          custom_on_request?: boolean
          personalizable?: boolean
          weight_grams?: number | null
          category_id?: string | null
          subcategory?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
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
