# Zero-setup execution: browsers install to match the pinned Playwright version.
FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci
RUN npx playwright install --with-deps chromium

COPY . .

# docker run playwright-portfolio
# docker run -e BASE_URL=https://your-app.com playwright-portfolio
CMD ["npm", "run", "test:all"]
