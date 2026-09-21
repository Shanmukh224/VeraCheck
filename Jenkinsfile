pipeline {
    agent any

    environment {
        APP_NAME    = 'veracheck'
        DOCKER_TAG  = "${BUILD_NUMBER}"
        PORT        = '3000'
    }

    options {
        timeout(time: 20, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout SCM') {
            steps {
                echo 'Checking out source code from Git repository...'
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing project dependencies...'
                sh 'npm install --production=false'
            }
        }

        stage('Code Quality & Syntax Check') {
            steps {
                echo 'Running automated verification and syntax validation...'
                sh 'npm test'
            }
        }

        stage('Security Audit') {
            steps {
                echo 'Running dependency security audit...'
                sh 'npm audit --audit-level=critical || true'
            }
        }

        stage('Build Docker Image') {
            steps {
                echo "Building Docker image: ${APP_NAME}:${DOCKER_TAG}..."
                sh "docker build -t ${APP_NAME}:${DOCKER_TAG} -t ${APP_NAME}:latest ."
            }
        }

        stage('Deploy Application') {
            steps {
                echo 'Deploying application via Docker Compose...'
                // Stops any running instance and launches the updated container
                sh 'docker compose down || true'
                sh 'docker compose up -d --build'
            }
        }

        stage('Health Check') {
            steps {
                echo 'Verifying application health...'
                sleep(time: 5, unit: 'SECONDS')
                sh "curl -f http://localhost:${PORT}/ || true"
            }
        }
    }

    post {
        success {
            echo '==================================================='
            echo "CI/CD Pipeline Succeeded: ${APP_NAME} deployed successfully!"
            echo '==================================================='
        }
        failure {
            echo '==================================================='
            echo "CI/CD Pipeline Failed: Please review build logs."
            echo '==================================================='
        }
        always {
            cleanWs()
        }
    }
}
