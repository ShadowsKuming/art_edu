<script setup lang="ts">
// 2026-05-28: this placeholder component is the legacy Part-7 stub —
// `Part7Content.vue` is the real implementation. The footer "Save"
// and "Save & Next" buttons were removed here as part of the
// site-wide retirement of per-part progression buttons. The
// `slideStore` import is no longer needed and `navigateToNextPart`
// has been retired in the store.
</script>

<template>
  <section class="p7-content">
    <div class="p7-body">
      <div class="p7-card">
        <svg viewBox="0 0 48 48" fill="none" class="p7-icon">
          <circle cx="24" cy="24" r="22" stroke="#7FEC8F" stroke-width="2"/>
          <path d="M16 24h16M24 16v16" stroke="#7FEC8F" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        <h2 class="p7-title">Share & Feedback</h2>
        <p class="p7-desc">This section is coming soon. Students will be able to share their work and provide feedback here.</p>
      </div>
    </div>

    <!-- 2026-05-28: Part 7 placeholder footer + "Save" / "Save & Next"
         buttons removed site-wide along with all per-part
         progression buttons. -->
  </section>
</template>

<style scoped>
.p7-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #F3F4F4;
  background-image: radial-gradient(circle, rgba(0,0,0,0.25) 1px, transparent 1px);
  background-size: 24px 24px;
  box-shadow: inset 0px 0px 3px 2px rgb(0 0 0 / 10%), inset 0px 0px 1px 0px rgba(0,0,0,0.60);
}

.p7-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 32px;
}

.p7-card {
  background: #fff;
  border-radius: 20px;
  padding: 48px 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  max-width: 480px;
  text-align: center;
}

.p7-icon { width: 56px; height: 56px; }

.p7-title {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.p7-desc {
  font-size: 15px;
  color: #6b7280;
  line-height: 1.6;
  margin: 0;
}

.p7-footer {
  padding: 16px 32px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.p7-save-plain-btn {
  height: 44px;
  padding: 0 24px;
  background: #e6e6e6;
  color: #374151;
  border: none;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.p7-save-plain-btn:hover { background: #d8d8d8; }

.p7-save-btn {
  height: 44px;
  padding: 0 28px;
  background: #7FEC8F;
  color: #000;
  border: none;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 2px 3px 6px rgba(0,0,0,0.12);
}

.p7-save-btn:hover { transform: translateY(-1px) scale(1.02); }
</style>
