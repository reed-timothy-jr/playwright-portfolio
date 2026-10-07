# Zero-setup execution: browsers install to match the pinned Playwright version.
FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci
RUN npx playwright install --with-deps chromium

COPY . .

# docker run powerbase-playwright-framework
# docker run -e BASE_URL=https://your-app.com powerbase-playwright-framework
CMD ["npm", "run", "test:all"]
