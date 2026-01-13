/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#0a0a0f",
                card: "#13131f",
                "card-hover": "#1c1c2e",
                primary: "#6d28d9", // Purple
                secondary: "#db2777", // Pink
                accent: "#22d3ee", // Cyan
                glass: "rgba(255, 255, 255, 0.05)",
                "glass-border": "rgba(255, 255, 255, 0.1)",
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            animation: {
                "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }
        },
    },
    plugins: [],
}
