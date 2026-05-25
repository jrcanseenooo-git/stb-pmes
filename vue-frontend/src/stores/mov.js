// src/stores/mov.js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { movApi } from '@/services/api'
import { useToast } from 'vue-toastification'

export const useMovStore = defineStore('mov', () => {
  const toast   = useToast()
  const files   = ref([])
  const loading = ref(false)
  const uploading = ref(false)
  const uploadProgress = ref(0)

  async function fetchAll(params = {}) {
    loading.value = true
    try {
      files.value = await movApi.list(params)
    } finally {
      loading.value = false
    }
  }

  async function upload(file, meta) {
    // meta: { accomplishmentId, kraId, siId, description }
    uploading.value      = true
    uploadProgress.value = 0

    const reader = new FileReader()
    const base64 = await new Promise((resolve, reject) => {
      reader.onload  = e => resolve(e.target.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    try {
      const result = await movApi.upload({
        fileName:  file.name,
        mimeType:  file.type,
        size:      file.size,
        base64,
        ...meta
      })
      files.value.unshift(result)
      toast.success(`${file.name} uploaded successfully`)
      return result
    } catch (e) {
      toast.error(`Upload failed: ${e.message}`)
      throw e
    } finally {
      uploading.value = false
    }
  }

  async function remove(id) {
    await movApi.delete(id)
    files.value = files.value.filter(f => f.id !== id)
    toast.success('File removed')
  }

  return { files, loading, uploading, uploadProgress, fetchAll, upload, remove }
})
