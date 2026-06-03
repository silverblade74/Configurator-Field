import { expect, test } from '@playwright/test'

test('login page renders and exposes registration', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible()
})

test('register page describes approval flow', async ({ page }) => {
  await page.goto('/register')
  await expect(page.getByRole('heading', { name: /join volunteerhub/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /create account/i })).toBeVisible()
})
