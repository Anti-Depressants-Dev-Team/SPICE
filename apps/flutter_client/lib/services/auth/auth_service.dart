/// Auth surface for Spice clients.
///
/// Phase 0: skeleton. Phase 4 implements:
/// - Spice account: email/password (argon2id on the backend) + JWT session
/// - Google OAuth link: stores refresh token server-side, used to read the
///   user's real YT Music library
class AuthService {
  Future<void> signInSpice(String email, String password) async {
    throw UnimplementedError('Phase 4');
  }

  Future<void> linkGoogle() async {
    throw UnimplementedError('Phase 4');
  }
}
