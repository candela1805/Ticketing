using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Ticket.Data;
using Ticket.DTOs;
using Ticket.Services;

namespace Ticket.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IPasswordHashService _passwordHashService;

    public AuthController(
        AppDbContext context,
        IPasswordHashService passwordHashService)
    {
        _context = context;
        _passwordHashService = passwordHashService;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(currentUser => currentUser.Email == email);

        if (user is null || !_passwordHashService.VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Email o contraseña incorrectos" });
        }

        return Ok(new UserResponseDto
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Role = user.Role
        });
    }
}
