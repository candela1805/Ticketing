using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Ticket.Data;
using Ticket.DTOs;
using Ticket.Models;
using Ticket.Services;

namespace Ticket.Controllers;

[ApiController]
[Route("api/v1/users")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IPasswordHashService _passwordHashService;

    public UsersController(
        AppDbContext context,
        IPasswordHashService passwordHashService)
    {
        _context = context;
        _passwordHashService = passwordHashService;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _context.Users
            .AsNoTracking()
            .OrderBy(user => user.Role)
            .ThenBy(user => user.Name)
            .Select(user => new UserResponseDto
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                Role = user.Role
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpPost("employees")]
    public async Task<IActionResult> CreateEmployee([FromBody] CreateEmployeeRequest request)
    {
        var admin = await _context.Users.FindAsync(request.AdminUserId);
        if (admin is null || admin.Role != UserRoles.Admin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Solo admin puede crear empleados" });
        }

        var validationError = ValidateEmployeeRequest(request);
        if (validationError is not null)
        {
            return BadRequest(new { message = validationError });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var emailExists = await _context.Users.AnyAsync(user => user.Email == normalizedEmail);
        if (emailExists)
        {
            return Conflict(new { message = "Ya existe un usuario con ese email" });
        }

        var documentNumber = request.DocumentNumber.Trim();
        var documentExists = await _context.Employees.AnyAsync(employee => employee.DocumentNumber == documentNumber);
        if (documentExists)
        {
            return Conflict(new { message = "Ya existe un empleado con ese documento" });
        }

        await using var transaction = await _context.Database.BeginTransactionAsync();

        var user = new User
        {
            Name = request.Name.Trim(),
            Email = normalizedEmail,
            PasswordHash = _passwordHashService.HashPassword(request.Password),
            Role = UserRoles.Employee
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        _context.Employees.Add(new Employee
        {
            UserId = user.Id,
            DocumentNumber = documentNumber,
            Phone = request.Phone.Trim(),
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return Created($"/api/v1/users/{user.Id}", new UserResponseDto
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Role = user.Role
        });
    }

    [HttpPost("clients")]
    public async Task<IActionResult> CreateClient([FromBody] CreateClientRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Nombre, email y contraseña son obligatorios" });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var emailExists = await _context.Users.AnyAsync(user => user.Email == normalizedEmail);
        if (emailExists)
        {
            return Conflict(new { message = "Ya existe un usuario con ese email" });
        }

        await using var transaction = await _context.Database.BeginTransactionAsync();

        var client = new User
        {
            Name = request.Name.Trim(),
            Email = normalizedEmail,
            PasswordHash = _passwordHashService.HashPassword(request.Password),
            Role = UserRoles.Client
        };

        _context.Users.Add(client);
        await _context.SaveChangesAsync();

        _context.Clients.Add(new Client
        {
            UserId = client.Id,
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return Created($"/api/v1/users/{client.Id}", new UserResponseDto
        {
            Id = client.Id,
            Name = client.Name,
            Email = client.Email,
            Role = client.Role
        });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _context.Users.FindAsync(id);

        if (user == null)
        {
            return NotFound(new { message = "Usuario no encontrado" });
        }

        if (user.Role == "Admin")
        {
            return BadRequest(new { message = "No se puede eliminar un administrador" });
        }

        try
        {
            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Usuario eliminado correctamente" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error al eliminar: " + ex.Message });
        }
    }


    private static string? ValidateEmployeeRequest(CreateEmployeeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Password) ||
            string.IsNullOrWhiteSpace(request.DocumentNumber) ||
            string.IsNullOrWhiteSpace(request.Phone))
        {
            return "Nombre, email, contraseña, documento y telefono son obligatorios";
        }

        return null;
    }
}
