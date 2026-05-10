import 'package:flutter/material.dart';

ThemeData spiceTheme({required Brightness brightness}) {
  final scheme = ColorScheme.fromSeed(
    seedColor: const Color(0xFFE85A2B),
    brightness: brightness,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    visualDensity: VisualDensity.adaptivePlatformDensity,
  );
}
