// Main JavaScript functionality for Skill Swap Platform

document.addEventListener('DOMContentLoaded', function() {
    // Mobile navigation toggle
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            navToggle.classList.toggle('active');
        });
    }

    // Form validation
    const forms = document.querySelectorAll('form[data-validate]');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!validateForm(form)) {
                e.preventDefault();
            }
        });
    });

    // Skills input functionality
    initializeSkillsInput();

    // Rating stars functionality
    initializeRatingStars();

    // Confirmation dialogs
    initializeConfirmationDialogs();

    // Auto-hide alerts
    autoHideAlerts();

    // Image preview for file uploads
    initializeImagePreview();
});

// Form validation
function validateForm(form) {
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            showFieldError(field, 'This field is required');
            isValid = false;
        } else {
            clearFieldError(field);
        }
    });

    // Email validation
    const emailFields = form.querySelectorAll('input[type="email"]');
    emailFields.forEach(field => {
        if (field.value && !isValidEmail(field.value)) {
            showFieldError(field, 'Please enter a valid email address');
            isValid = false;
        }
    });

    // Password confirmation
    const passwordField = form.querySelector('input[name="password"]');
    const confirmPasswordField = form.querySelector('input[name="confirmPassword"]');
    
    if (passwordField && confirmPasswordField) {
        if (passwordField.value !== confirmPasswordField.value) {
            showFieldError(confirmPasswordField, 'Passwords do not match');
            isValid = false;
        }
    }

    return isValid;
}

function showFieldError(field, message) {
    field.classList.add('is-invalid');
    
    // Remove existing error message
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }

    // Add new error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error text-danger mt-1';
    errorDiv.textContent = message;
    field.parentNode.appendChild(errorDiv);
}

function clearFieldError(field) {
    field.classList.remove('is-invalid');
    const errorDiv = field.parentNode.querySelector('.field-error');
    if (errorDiv) {
        errorDiv.remove();
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Skills input functionality
function initializeSkillsInput() {
    const skillsContainers = document.querySelectorAll('.skills-input-container');
    
    skillsContainers.forEach(container => {
        const input = container.querySelector('.skills-input');
        const tagsContainer = container.querySelector('.skills-tags');
        const hiddenInput = container.querySelector('.skills-hidden');
        
        if (!input || !tagsContainer || !hiddenInput) return;

        let skills = [];
        
        // Load existing skills
        if (hiddenInput.value) {
            skills = JSON.parse(hiddenInput.value);
            renderSkillTags();
        }

        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addSkill();
            }
        });

        input.addEventListener('blur', addSkill);

        function addSkill() {
            const skill = input.value.trim();
            if (skill && !skills.includes(skill) && skills.length < 20) {
                skills.push(skill);
                input.value = '';
                renderSkillTags();
                updateHiddenInput();
            }
        }

        function removeSkill(index) {
            skills.splice(index, 1);
            renderSkillTags();
            updateHiddenInput();
        }

        function renderSkillTags() {
            tagsContainer.innerHTML = '';
            skills.forEach((skill, index) => {
                const tag = document.createElement('span');
                tag.className = 'skill-tag';
                tag.innerHTML = `
                    ${skill}
                    <button type="button" class="remove-skill" data-index="${index}">×</button>
                `;
                tagsContainer.appendChild(tag);
            });

            // Add event listeners to remove buttons
            tagsContainer.querySelectorAll('.remove-skill').forEach(btn => {
                btn.addEventListener('click', function() {
                    removeSkill(parseInt(this.dataset.index));
                });
            });
        }

        function updateHiddenInput() {
            hiddenInput.value = JSON.stringify(skills);
        }
    });
}

// Rating stars functionality
function initializeRatingStars() {
    const ratingContainers = document.querySelectorAll('.rating-input');
    
    ratingContainers.forEach(container => {
        const stars = container.querySelectorAll('.star');
        const hiddenInput = container.querySelector('input[type="hidden"]');
        
        stars.forEach((star, index) => {
            star.addEventListener('click', function() {
                const rating = index + 1;
                hiddenInput.value = rating;
                
                // Update star display
                stars.forEach((s, i) => {
                    if (i < rating) {
                        s.classList.add('active');
                        s.classList.remove('empty');
                    } else {
                        s.classList.remove('active');
                        s.classList.add('empty');
                    }
                });
            });

            star.addEventListener('mouseover', function() {
                const rating = index + 1;
                
                // Highlight stars on hover
                stars.forEach((s, i) => {
                    if (i < rating) {
                        s.classList.add('hover');
                    } else {
                        s.classList.remove('hover');
                    }
                });
            });
        });

        container.addEventListener('mouseleave', function() {
            // Remove hover effects
            stars.forEach(s => s.classList.remove('hover'));
        });
    });
}

// Confirmation dialogs
function initializeConfirmationDialogs() {
    const confirmButtons = document.querySelectorAll('[data-confirm]');
    
    confirmButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            const message = this.dataset.confirm;
            if (!confirm(message)) {
                e.preventDefault();
            }
        });
    });
}

// Auto-hide alerts
function autoHideAlerts() {
    const alerts = document.querySelectorAll('.alert[data-auto-hide]');
    
    alerts.forEach(alert => {
        const delay = parseInt(alert.dataset.autoHide) || 5000;
        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => {
                alert.remove();
            }, 300);
        }, delay);
    });
}

// Image preview for file uploads
function initializeImagePreview() {
    const fileInputs = document.querySelectorAll('input[type="file"][data-preview]');
    
    fileInputs.forEach(input => {
        input.addEventListener('change', function() {
            const file = this.files[0];
            const previewId = this.dataset.preview;
            const preview = document.getElementById(previewId);
            
            if (file && preview) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    });
}

// Utility functions
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} toast`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// AJAX helper
function makeRequest(url, options = {}) {
    const defaultOptions = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    const config = { ...defaultOptions, ...options };
    
    return fetch(url, config)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .catch(error => {
            console.error('Request failed:', error);
            throw error;
        });
}
