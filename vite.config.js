import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'firebase-firestore',
              test: /node_modules[\\/](@firebase[\\/]firestore|firebase[\\/]firestore)/,
              priority: 30
            },
            {
              name: 'firebase-auth',
              test: /node_modules[\\/](@firebase[\\/]auth|firebase[\\/]auth)/,
              priority: 30
            },
            {
              name: 'firebase-analytics',
              test: /node_modules[\\/](@firebase[\\/]analytics|firebase[\\/]analytics)/,
              priority: 30
            },
            {
              name: 'firebase',
              test: /node_modules[\\/](@firebase|firebase)[\\/]/,
              priority: 20
            },
            {
              name: 'vue-vendor',
              test: /node_modules[\\/](vue|@vue|vue-router|pinia)[\\/]/,
              priority: 20
            },
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              priority: 10
            }
          ]
        }
      }
    }
  }
})
