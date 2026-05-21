// vite.config.ts
import { defineConfig, loadEnv } from "file:///sessions/quirky-intelligent-galileo/mnt/Work/fanaticscores/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/quirky-intelligent-galileo/mnt/Work/fanaticscores/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api/fd": {
          target: "https://api.football-data.org/v4",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/fd/, ""),
          headers: {
            "X-Auth-Token": env.VITE_FD_API_KEY ?? ""
          }
        },
        "/api/fetchMatchday": {
          target: "https://us-central1-fanaticscores-b6af4.cloudfunctions.net",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/fetchMatchday/, "/fetchMatchdayHttp")
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvcXVpcmt5LWludGVsbGlnZW50LWdhbGlsZW8vbW50L1dvcmsvZmFuYXRpY3Njb3Jlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL3F1aXJreS1pbnRlbGxpZ2VudC1nYWxpbGVvL21udC9Xb3JrL2ZhbmF0aWNzY29yZXMvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL3F1aXJreS1pbnRlbGxpZ2VudC1nYWxpbGVvL21udC9Xb3JrL2ZhbmF0aWNzY29yZXMvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XG4gIGNvbnN0IGVudiA9IGxvYWRFbnYobW9kZSwgcHJvY2Vzcy5jd2QoKSwgJycpXG5cbiAgcmV0dXJuIHtcbiAgICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gICAgc2VydmVyOiB7XG4gICAgICBwcm94eToge1xuICAgICAgICAnL2FwaS9mZCc6IHtcbiAgICAgICAgICB0YXJnZXQ6ICdodHRwczovL2FwaS5mb290YmFsbC1kYXRhLm9yZy92NCcsXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9hcGlcXC9mZC8sICcnKSxcbiAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAnWC1BdXRoLVRva2VuJzogZW52LlZJVEVfRkRfQVBJX0tFWSA/PyAnJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAnL2FwaS9mZXRjaE1hdGNoZGF5Jzoge1xuICAgICAgICAgIHRhcmdldDogJ2h0dHBzOi8vdXMtY2VudHJhbDEtZmFuYXRpY3Njb3Jlcy1iNmFmNC5jbG91ZGZ1bmN0aW9ucy5uZXQnLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYXBpXFwvZmV0Y2hNYXRjaGRheS8sICcvZmV0Y2hNYXRjaGRheUh0dHAnKSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfVxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBbVcsU0FBUyxjQUFjLGVBQWU7QUFDelksT0FBTyxXQUFXO0FBRWxCLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQ3hDLFFBQU0sTUFBTSxRQUFRLE1BQU0sUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUUzQyxTQUFPO0FBQUEsSUFDTCxTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsSUFDakIsUUFBUTtBQUFBLE1BQ04sT0FBTztBQUFBLFFBQ0wsV0FBVztBQUFBLFVBQ1QsUUFBUTtBQUFBLFVBQ1IsY0FBYztBQUFBLFVBQ2QsU0FBUyxDQUFDLFNBQVMsS0FBSyxRQUFRLGNBQWMsRUFBRTtBQUFBLFVBQ2hELFNBQVM7QUFBQSxZQUNQLGdCQUFnQixJQUFJLG1CQUFtQjtBQUFBLFVBQ3pDO0FBQUEsUUFDRjtBQUFBLFFBQ0Esc0JBQXNCO0FBQUEsVUFDcEIsUUFBUTtBQUFBLFVBQ1IsY0FBYztBQUFBLFVBQ2QsU0FBUyxDQUFDLFNBQVMsS0FBSyxRQUFRLHlCQUF5QixvQkFBb0I7QUFBQSxRQUMvRTtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
