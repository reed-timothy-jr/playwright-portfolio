// Jenkins — reference implementation of the framework's gate contract.
// Same gates, same order as .github/workflows/ci.yml:
//   install -> lint -> typecheck -> tests (five pillars + support) -> dependency audit -> evidence
// Requires the Docker Pipeline plugin. The Playwright image ships browsers + OS deps,
// so no browser install step is needed.
pipeline {
    agent {
        docker {
            image 'mcr.microsoft.com/playwright:v1.55.0-noble'
            args '--ipc=host'
        }
    }

    options {
        timestamps()
        timeout(time: 45, unit: 'MINUTES')
    }

    stages {
        stage('Install') {
            steps { sh 'npm ci' }
        }
        stage('Lint') {
            steps { sh 'npm run lint' }
        }
        // Typecheck is explicit because Playwright transpiles TypeScript without type-checking it.
        stage('Typecheck') {
            steps { sh 'npm run typecheck' }
        }
        stage('Test') {
            steps { sh 'npm run test:all' }
        }
        // Dependency audit gate (high+ severity fails the build).
        stage('Security audit') {
            steps { sh 'npm run audit:sec' }
        }
    }

    post {
        always {
            // First-attempt vs retry breakdown — retries hide rot, this makes it visible.
            sh 'npm run report:flakiness || true'
            archiveArtifacts artifacts: 'playwright-report/**, test-results/**', allowEmptyArchive: true
        }
    }
}
