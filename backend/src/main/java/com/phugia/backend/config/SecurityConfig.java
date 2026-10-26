
package com.phugia.backend.config;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.proc.SecurityContext;

import com.phugia.backend.entity.AppUser;
import com.phugia.backend.repository.AppUserRepository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.http.HttpMethod;

import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;

import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;

import org.springframework.security.core.authority.SimpleGrantedAuthority;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import org.springframework.security.web.SecurityFilterChain;

import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import java.util.Base64;
import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    // =========================================
    // MÃ HÓA MẬT KHẨU
    // =========================================

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    // =========================================
    // JWT SIGNING KEY
    // =========================================

    private SecretKey createJwtKey(String secretBase64) {

        if (secretBase64 == null || secretBase64.isBlank()) {
            throw new IllegalStateException(
                "JWT_SECRET_BASE64 chua duoc cau hinh."
            );
        }

        final byte[] keyBytes;

        try {
            keyBytes = Base64.getDecoder().decode(secretBase64);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException(
                "JWT_SECRET_BASE64 khong phai Base64 hop le.",
                ex
            );
        }

        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                "JWT secret phai co it nhat 32 byte."
            );
        }

        return new SecretKeySpec(
            keyBytes,
            "HmacSHA256"
        );
    }

    // =========================================
    // JWT ENCODER
    // =========================================

    @Bean
    public JwtEncoder jwtEncoder(
        @Value("${app.jwt.secret-base64}") String secret
    ) {
        SecretKey key = createJwtKey(secret);

        return new NimbusJwtEncoder(
            new ImmutableSecret<SecurityContext>(key)
        );
    }

    // =========================================
    // JWT DECODER
    // =========================================

    @Bean
    public JwtDecoder jwtDecoder(
        @Value("${app.jwt.secret-base64}") String secret
    ) {
        SecretKey key = createJwtKey(secret);

        NimbusJwtDecoder decoder =
            NimbusJwtDecoder
                .withSecretKey(key)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();

        decoder.setJwtValidator(
            JwtValidators.createDefaultWithIssuer(
                "phugia-agent"
            )
        );

        return decoder;
    }

    // =========================================
    // CORS
    // =========================================

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {

        CorsConfiguration config = new CorsConfiguration();

        config.setAllowedOrigins(
            List.of(
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "https://phugia-frontend.onrender.com"
            )
        );

        config.setAllowedMethods(
            List.of(
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
                "OPTIONS"
            )
        );

        config.setAllowedHeaders(
            List.of(
                "Authorization",
                "Content-Type"
            )
        );

        config.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source =
            new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration(
            "/**",
            config
        );

        return source;
    }

    // =========================================
    // API SECURITY
    // =========================================

    @Bean
    public SecurityFilterChain securityFilterChain(
        HttpSecurity http,
        AppUserRepository appUserRepository
    ) throws Exception {

        http
            .csrf(AbstractHttpConfigurer::disable)

            .cors(cors -> {})

            .sessionManagement(session ->
                session.sessionCreationPolicy(
                    SessionCreationPolicy.STATELESS
                )
            )

            .authorizeHttpRequests(authorize -> authorize

                // CORS PREFLIGHT
                .requestMatchers(
                    HttpMethod.OPTIONS,
                    "/**"
                ).permitAll()

                // API MẶT BẰNG CÔNG KHAI
                .requestMatchers(
                    HttpMethod.GET,
                    "/api/public/**"
                ).permitAll()

                // ĐĂNG NHẬP CÔNG KHAI
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/auth/login"
                ).permitAll()

                // ĐĂNG KÝ CÔNG KHAI
                // Backend chỉ tạo tài khoản USER.
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/auth/register"
                ).permitAll()

                // XEM TÀI KHOẢN HIỆN TẠI
                .requestMatchers(
                    HttpMethod.GET,
                    "/api/auth/me"
                ).authenticated()

                // CHỈ ADMIN
                .requestMatchers(
                    "/api/admin/**"
                ).hasRole("ADMIN")

                // AGENT HOẶC ADMIN
                .requestMatchers(
                    "/api/agent/**"
                ).hasAnyRole("AGENT", "ADMIN")

                .requestMatchers("/error").permitAll()

                // CÁC API KHÁC BỊ CHẶN
                .anyRequest().denyAll()
            )

            .oauth2ResourceServer(oauth2 ->
                oauth2.jwt(jwt ->

                    jwt.jwtAuthenticationConverter(token -> {

                        final Long userId;

                        try {
                            userId = Long.valueOf(
                                token.getSubject()
                            );
                        } catch (NumberFormatException ex) {
                            throw new BadCredentialsException(
                                "JWT khong hop le."
                            );
                        }

                        // Luôn lấy role hiện tại từ DB.
                        AppUser user = appUserRepository
                            .findById(userId)
                            .orElseThrow(() ->
                                new BadCredentialsException(
                                    "Tai khoan khong ton tai."
                                )
                            );

                        if (!Boolean.TRUE.equals(user.getEnabled())) {
                            throw new DisabledException(
                                "Tai khoan da bi khoa."
                            );
                        }

                        return new JwtAuthenticationToken(
                            token,
                            List.of(
                                new SimpleGrantedAuthority(
                                    "ROLE_" +
                                    user.getRole().name()
                                )
                            ),
                            user.getEmail()
                        );
                    })
                )
            );

        return http.build();
    }
}
